"""
Git Repository Evaluator
Evaluates GitHub repositories and provides project information, purpose, and details
"""
import os
import logging
from typing import List, Dict, Optional
from .gemini_service import GeminiService

logger = logging.getLogger(__name__)


class GitEvaluator:
    """Service to evaluate Git repositories and provide project insights"""
    
    def __init__(self, gemini_service: GeminiService):
        self.gemini_service = gemini_service

    def build_evaluation_prompt(self, github_url: str, files: List[Dict]) -> str:
        per_file_limit = int(os.getenv("GIT_EVAL_PER_FILE_CHAR_LIMIT", "15000"))
        total_limit = int(os.getenv("GIT_EVAL_TOTAL_CHAR_LIMIT", "100000"))
        prepared_files, current_total = [], 0
        
        # Sort files for deterministic ordering
        sorted_files = sorted(files, key=lambda f: f.get('path', ''))
        
        for f in sorted_files:
            content = str(f.get('content', ''))
            truncated_note = f"\n[TRUNCATED {len(content)-per_file_limit} chars]" if len(content) > per_file_limit else ""
            content = content[:per_file_limit]
            if current_total + len(content) > total_limit: break
            prepared_files.append({'path': f.get('path', ''), 'content': f"{content}{truncated_note}"})
            current_total += len(content)
        
        # Standardized, deterministic prompt
        parts = [
            "### ROLE: Expert software architect and code analyst.\n",
            f"### ANALYZE GITHUB REPOSITORY: {github_url}\n",
            "### TASK: Analyze the repository structure, purpose, technology stack, and features.\n",
            "### READ FILES CAREFULLY & COMPLETELY.\n",
            "### PROVIDE EXACT, CONSISTENT ANALYSIS.\n\n"
        ]
        
        for f in prepared_files:
            parts.append(f"--- FILE: {f['path']} ---\n{f['content']}\n\n")
        
        parts.append("### ANALYSIS REQUIREMENTS:\n")
        parts.append("1. Project purpose and main functionality\n")
        parts.append("2. Intended use cases and applications\n")
        parts.append("3. Technology stack (languages, frameworks, tools)\n")
        parts.append("4. Key features and capabilities\n")
        parts.append("5. Project structure and organization\n")
        
        return "".join(parts)
    
    async def evaluate_repository(self, github_url: str, files: List[Dict]) -> Dict:
        if not files: return {"success": False, "error": "No files found"}
        try:
            prompt = self.build_evaluation_prompt(github_url, files)
            res = await self.gemini_service.evaluate_git_repository_structured(prompt)
            if not res.get("success"):
                return {"success": False, "error": res.get("error", {}).get("message", "LLM Unavailable"), "is_llm_fail": True}
            return {"success": True, "result": res.get("response")}
        except Exception as e:
            logger.error(f"Error evaluating repo: {e}"); return {"success": False, "error": str(e)}

    def build_grading_prompt(self, github_url: str, files: List[Dict], description: str) -> str:
        per_file_limit = int(os.getenv("GIT_EVAL_PER_FILE_CHAR_LIMIT", "15000"))
        total_limit = int(os.getenv("GIT_EVAL_TOTAL_CHAR_LIMIT", "100000"))
        prepared_files, current_total = [], 0
        
        # Sort files for deterministic ordering
        sorted_files = sorted(files, key=lambda f: f.get('path', ''))
        
        for f in sorted_files:
            content = str(f.get('content', ''))
            content = content[:per_file_limit]
            if current_total + len(content) > total_limit: break
            prepared_files.append({'path': f.get('path', ''), 'content': content})
            current_total += len(content)
        
        # Standardized, deterministic grading prompt
        parts = [
            "### ROLE: Senior Software Engineer & Code Evaluator.\n",
            f"### EVALUATE GITHUB REPOSITORY: {github_url}\n",
            f"### USER QUESTION / REQUIREMENTS:\n{description}\n\n",
            "### TASK: Answer the user's question explicitly based ONLY on the provided code files.\n",
            "### RULES:\n",
            "1. **STRICT ADHERENCE**: Answer ONLY what is asked in the USER QUESTION.\n",
            "2. **EVIDENCE BASED**: Your answer must be derived 100% from the file contents provided below.\n",
            "3. **NO GUESSING**: If the answer is not in the code, state 'Not found in the provided files'. Do NOT hallucinate or guess path names/logic.\n",
            "4. **DIRECT ANSWER**: Do not provide generic summaries unless asked. Address the specific query directly.\n",
            "5. **NO SCORES**: Do not provide a numerical score.\n\n"
        ]
        
        for f in prepared_files:
            parts.append(f"--- FILE: {f['path']} ---\n{f['content']}\n\n")
        
        parts.append("### INSTRUCTIONS:\n")
        parts.append("- Provide a clear, conversational answer to the User Question.\n")
        parts.append("- Cite specific files or lines of code where relevant to support your answer.\n")
        
        return "".join(parts)

    async def grade_repository(self, github_url: str, files: List[Dict], description: str) -> Dict:
        if not files or not description: return {"success": False, "error": "Missing input"}
        try:
            prompt = self.build_grading_prompt(github_url, files, description)
            res = await self.gemini_service.grade_git_repository_structured(prompt)
            if not res.get("success"):
                return {"success": False, "error": res.get("error", {}).get("message", "LLM Unavailable"), "is_llm_fail": True}
            return {"success": True, "result": res.get("response")}
        except Exception as e:
            logger.error(f"Error grading repo: {e}"); return {"success": False, "error": str(e)}
