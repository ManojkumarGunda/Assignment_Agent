import os
import time
import logging
import asyncio
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv()

logger = logging.getLogger(__name__)

# Constants for retry logic
MAX_LLM_RETRIES = 3
BACKOFF_BASE = 1.0

class ExtractedQA(BaseModel):
    question: str = Field(description="The question text extracted from the document")
    student_answer: str = Field(description="The student's answer text extracted from the document")
    is_answer_present: bool = Field(description="Whether an answer was found for this question")

class ExtractedQAList(BaseModel):
    qa_pairs: List[ExtractedQA] = Field(description="List of question-answer pairs extracted from the document")

class EvalDetail(BaseModel):
    question: str = Field(description="The question being evaluated")
    student_answer: str = Field(description="The student's answer being evaluated")
    correct_answer: str = Field(description="The correct answer for the question")
    is_correct: bool = Field(description="Whether the student's answer is correct")
    partial_credit: Optional[float] = Field(None, description="Partial credit score (0.0, 0.25, 0.5, 0.75, 1.0)", ge=0.0, le=1.0)
    feedback: str = Field(description="Detailed feedback on the student's answer")

class PPTEvalCriteria(BaseModel):
    score: int = Field(description="Score between 0 and 100")
    feedback: str = Field(description="Brief feedback on the criteria")

class PPTEvaluation(BaseModel):
    content_quality: PPTEvalCriteria
    structure: PPTEvalCriteria
    alignment: PPTEvalCriteria
    strengths: List[str]
    improvements: List[str]
    summary: str

class PPTDesignEvaluation(BaseModel):
    visual_clarity: PPTEvalCriteria
    layout_balance: PPTEvalCriteria
    color_consistency: PPTEvalCriteria
    typography: PPTEvalCriteria
    visual_appeal: PPTEvalCriteria
    design_strengths: List[str]
    design_improvements: List[str]
    design_summary: str

class GitProjectInfo(BaseModel):
    project_about: str
    project_use: str
    technology_stack: List[str]
    features: List[str]
    project_structure: str

class GitRuleResult(BaseModel):
    rule_text: str
    is_satisfied: bool
    severity: str
    evidence: str
    failure_reason: str

class GitTechMismatch(BaseModel):
    expected_from_description: str
    actual_from_code: str
    has_mismatch: bool
    details: str

class GitGradingResult(BaseModel):
    rules_summary: str
    overall_comment: str
    conversational_response: str = Field(description="Direct, conversational answer to the user's specific question/description about the code.")
    score_percent: Optional[float] = Field(0.0, description="Deprecated/Filtered out score")
    detected_technology_stack: List[str]
    rule_results: List[GitRuleResult]
    technology_mismatch: GitTechMismatch

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
        self.max_retries = MAX_LLM_RETRIES
        self.backoff_base = BACKOFF_BASE
        
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            logger.warning("GEMINI_API_KEY not found in environment")

    def _get_client(self):
        if not self.client:
            self.api_key = os.getenv("GEMINI_API_KEY", "")
            if self.api_key:
                self.client = genai.Client(api_key=self.api_key)
        return self.client

    async def _call_gemini_core(self, contents: Any, config: types.GenerateContentConfig, response_schema: Optional[Any] = None, operation_name: str = "LLM Call") -> Dict:
        """
        Robust core wrapper for Gemini SDK with exponential retry and standardized error handling.
        """
        client = self._get_client()
        if not client:
            return {
                "success": False, 
                "error": {
                    "type": "CONFIG_ERROR", 
                    "message": "Gemini API key is missing",
                    "status_code": None,
                    "raw": "Client not initialized"
                }
            }

        attempt = 0
        last_error_msg = ""
        last_status_code = None

        while attempt <= self.max_retries:
            try:
                # DEBUG: Print exact input being sent to LLM
                print(f"\n🚀 [LLM INPUT] {operation_name} (Attempt {attempt+1}):")
                print("-" * 50)
                # Handle both string prompts and part-based prompts (vision)
                if isinstance(contents, str):
                    print(contents)
                elif isinstance(contents, list):
                    for part in contents:
                        if isinstance(part, str): print(part)
                        else: print(f"[Binary Part: {type(part)}]")
                print("-" * 50)

                # Use thread pool for blocking SDK call
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: client.models.generate_content(
                        model=self.model,
                        contents=contents,
                        config=config
                    )
                )

                # Successful execution
                raw_text = response.text or ""
                
                # DEBUG: Print exact output received from LLM
                print(f"\n✨ [LLM OUTPUT] {operation_name}:")
                print("-" * 50)
                print(raw_text)
                print("-" * 50 + "\n")

                if response_schema:
                    try:
                        data = response_schema.model_validate_json(raw_text)
                        return {"success": True, "response": data}
                    except Exception as parse_err:
                        logger.error(f"Structured parse failed for {operation_name}: {parse_err}")
                        return {
                            "success": False,
                            "error": {
                                "type": "PARSE_ERROR",
                                "message": f"Failed to parse structured output from {operation_name}",
                                "status_code": 200,
                                "raw": str(parse_err)
                            }
                        }
                else:
                    return {"success": True, "response": raw_text}

            except Exception as e:
                last_error_msg = str(e)
                last_status_code = getattr(e, 'status_code', None)
                
                # Detect status codes from message if not provided
                if last_status_code is None:
                    for code in [429, 500, 502, 503, 504]:
                        if str(code) in last_error_msg:
                            last_status_code = code
                            break
                
                retryable_codes = {429, 500, 502, 503, 504}
                retry_strings = ["overloaded", "timeout", "deadline", "connection", "rate limit", "busy"]
                
                is_retryable = (last_status_code in retryable_codes) or \
                               any(s in last_error_msg.lower() for s in retry_strings)
                
                if is_retryable and attempt < self.max_retries:
                    delay = 2 ** attempt
                    logger.warning(f"{operation_name} failed (status={last_status_code}), retrying in {delay}s... (Attempt {attempt+1}/{self.max_retries})")
                    await asyncio.sleep(delay)
                    attempt += 1
                    continue
                
                # Final failure
                logger.error(f"{operation_name} failed permanently after {attempt+1} attempts: {last_error_msg}")
                return {
                    "success": False,
                    "error": {
                        "type": "LLM_UNAVAILABLE",
                        "message": "LLM service unavailable after retries (e.g., 503 Model overloaded). Please try again later.",
                        "status_code": last_status_code,
                        "raw": last_error_msg
                    }
                }

        return {
            "success": False,
            "error": {
                "type": "LLM_UNAVAILABLE",
                "message": "LLM service exceeded maximum retry attempts.",
                "status_code": last_status_code,
                "raw": last_error_msg
            }
        }

    async def extract_qa_structured(self, text: str) -> Dict:
        """
        Uses Gemini structured output to extract QA pairs with standardized return.
        """
        prompt = f"""
        ### ROLE: You are a senior backend engineer and NLP specialist.
        Analyze and extract Question–Answer pairs.
        
        ### IMPORTANT RULES:
        1. Question labels: Q, Q., Q:, Q), Ques, Question, etc.
        2. Answer labels: Answer, Ans, A, A:, etc.
        3. Extract FULL text even if multi-line.
        
        ### TEXT TO ANALYZE:
        {text[:45000]}
        """
        config = types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=ExtractedQAList.model_json_schema(),
        )
        
        res = await self._call_gemini_core(prompt, config, ExtractedQAList, "QA Extraction")
        if res["success"]:
            # Flatten to compatibility format
            res["response"] = [qa.model_dump() for qa in res["response"].qa_pairs]
        return res

    async def evaluate_one_qa(self, description: str, question: str, student_answer: str) -> Dict:
        """
        Standardized per-question evaluation using a strict atomic call with structured output.
        """
        prompt = f"""
        ### ROLE: You are a strict and consistent academic grader.
        Evaluate the student's answer based ONLY on the provided rubric and question.
        
        ### RUBRIC/ASSIGNMENT DESCRIPTION:
        {description}
        
        ### QUESTION:
        {question}
        
        ### STUDENT ANSWER:
        {student_answer}
        
        ### GRADING RULES (STRICT & DETERMINISTIC):
        1. **RELEVANCE CHECK (CRITICAL)**:
           - If the student's answer is unrelated to the question or Rubric (Topic Mismatch), score MUST be **0.0**.
           - If the answer is blank or nonsense, score MUST be **0.0**.

        2. **SCORING TIERS (SELECT ONE ONLY)**:
           - **1.0 (PERFECT)**: The answer is fully correct. All key concepts are present. Code runs perfectly with optimal structure.
           - **0.5 (PARTIAL)**: The logic is generally correct but has minor errors, typos, or is missing one minor detail. The core concept is understood.
           - **0.0 (FAIL)**: The code has critical syntax errors, logic flaws, security vulnerabilities, or fails to answer the core question.

        3. **ZERO TOLERANCE RULES**:
           - **SYNTAX ERRORS**: If the code would fail to compile or run -> Score **0.0**.
           - **LOGIC FAILURES**: If the code outputs wrong results -> Score **0.0**.
           - **WRONG LANGUAGE**: If requested in Python but written in Java -> Score **0.0**.

        4. **FINAL DECISION**:
           - You MUST select exactly one of the three options: 0.0, 0.5, or 1.0. 
           - DO NOT giving floating scores like 0.75, 0.9, or 0.2.
           - `is_correct` must be true IF AND ONLY IF score is 1.0.

        5. **FEEDBACK**:
           - Provide the `correct_answer` for comparison.
           - Explain exactly why points were deducted (e.g., "Syntax error on line 5", "Missing edge case X").
        """
        
        # Use a stable, fixed model name for evaluation
        model_to_use = "gemini-2.5-pro" 
        
        config = types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=EvalDetail.model_json_schema(),
        )
        
        # We override self.model temporarily for evaluation to ensure stability
        original_model = self.model
        self.model = model_to_use
        
        try:
            # ------------------------------------------------------------------
            # Consensus Mechanism: 3 Parallel Calls -> Majority Vote
            # ------------------------------------------------------------------
            async def _single_eval_call():
                return await self._call_gemini_core(prompt, config, EvalDetail, "Question Evaluation Step")

            # Fire 3 requests in parallel
            results = await asyncio.gather(_single_eval_call(), _single_eval_call(), _single_eval_call())

            # Filter successful responses
            valid_responses = [r["response"] for r in results if r["success"] and "response" in r]

            if not valid_responses:
                # If all failed, return the error from the first one
                return results[0]

            # Voting Logic
            # Map simplified scores: 1.0 (Correct), 0.5 (Partial), 0.0 (Fail)
            votes = []
            for resp in valid_responses:
                score = 0.0
                if resp.is_correct:
                    score = 1.0
                elif resp.partial_credit is not None:
                    # Normalize partial credit to nearest bucket if needed, but usually it's 0.5
                    score = float(resp.partial_credit)
                votes.append(score)

            from collections import Counter
            vote_counts = Counter(votes)
            
            # Get the most common score
            # most_common returns e.g. [(1.0, 2), (0.0, 1)] -> we take 1.0
            winner_score, _ = vote_counts.most_common(1)[0]
            
            # Find the FIRST response that matches the winner score to return its feedback
            for resp in valid_responses:
                s = 1.0 if resp.is_correct else (float(resp.partial_credit) if resp.partial_credit is not None else 0.0)
                if s == winner_score:
                    # Log for debugging
                    logger.info(f"Consensus Result: {votes} -> Winner: {winner_score}")
                    return {"success": True, "response": resp}
            
            # Fallback (should never happen if logic is correct)
            return {"success": True, "response": valid_responses[0]}

        finally:
            self.model = original_model

    async def evaluate_ppt_structured(self, title: str, description: str, total_slides: int, slides_text: str) -> Dict:
        prompt = f"Evaluate PPT Content:\nTitle: {title}\nDescription: {description}\nSlides: {total_slides}\n\nContent:\n{slides_text}"
        config = types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=PPTEvaluation.model_json_schema(),
        )
        return await self._call_gemini_core(prompt, config, PPTEvaluation, "PPT Evaluation")

    async def evaluate_ppt_design_structured(self, design_description: str, filename: str, total_slides: int) -> Dict:
        prompt = f"Evaluate PPT Design:\nFile: {filename}\nSlides: {total_slides}\n\nMetadata:\n{design_description}"
        config = types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=PPTDesignEvaluation.model_json_schema(),
        )
        return await self._call_gemini_core(prompt, config, PPTDesignEvaluation, "PPT Design Evaluation")

    async def evaluate_ppt_design_vision_structured(self, slide_images_base64: List[str]) -> Dict:
        parts = ["Evaluate the design and visual quality of these PowerPoint slides."]
        for img_base64 in slide_images_base64:
            try:
                import base64 as b64_module
                img_bytes = b64_module.b64decode(img_base64)
                parts.append(types.Part.from_bytes(data=img_bytes, mime_type="image/png"))
            except Exception: pass
        config = types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=PPTDesignEvaluation.model_json_schema(),
        )
        return await self._call_gemini_core(parts, config, PPTDesignEvaluation, "PPT Vision Design Evaluation")

    async def evaluate_git_repository_structured(self, prompt: str) -> Dict:
        config = types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=GitProjectInfo.model_json_schema(),
        )
        return await self._call_gemini_core(prompt, config, GitProjectInfo, "Git Repo Analysis")

    async def grade_git_repository_structured(self, prompt: str) -> Dict:
        config = types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=GitGradingResult.model_json_schema(),
        )
        return await self._call_gemini_core(prompt, config, GitGradingResult, "Git Repo Grading")

    async def generate(self, prompt: str, model: Optional[str] = None, system_message: Optional[str] = None, temperature: float = 0.0) -> Dict:
        config = types.GenerateContentConfig(
            system_instruction=system_message or "You are a professional assistant.",
            temperature=temperature,
            max_output_tokens=50000,
        )
        return await self._call_gemini_core(prompt, config, None, "Generate Text")

    async def generate_with_images(self, messages: List[Dict], model: Optional[str] = None, system_message: Optional[str] = None, temperature: float = 0.0) -> Dict:
        # Compatibility wrapper for image messages
        parts = []
        for msg in messages:
            content = msg.get('content')
            if isinstance(content, list):
                for item in content:
                    if item.get('type') == 'text': parts.append(item.get('text'))
                    elif item.get('type') == 'image_url':
                        img_url = item.get('image_url', {}).get('url', '')
                        if img_url.startswith('data:image'):
                            try:
                                import base64 as b64_module
                                header, data_b64 = img_url.split(',', 1)
                                mime_type = header.split(';')[0].split(':')[1]
                                img_bytes = b64_module.b64decode(data_b64)
                                parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                            except Exception: pass
            else: parts.append(content)
        
        config = types.GenerateContentConfig(
            system_instruction=system_message or "Analyzes slide images.",
            temperature=temperature,
            max_output_tokens=50000,
        )
        return await self._call_gemini_core(parts, config, None, "Vision Generation")

    def check_connection(self) -> bool:
        """Compatibility check for LLM service status"""
        client = self._get_client()
        return client is not None

    def list_models(self) -> List[str]:
        """Compatibility list models (returns current configured model)"""
        return [self.model]
