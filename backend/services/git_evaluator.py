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
        for f in files:
            content = str(f.get('content', ''))
            truncated_note = f"\n[TRUNCATED {len(content)-per_file_limit} chars]" if len(content) > per_file_limit else ""
            content = content[:per_file_limit]
            if current_total + len(content) > total_limit: break
            prepared_files.append({'path': f.get('path', ''), 'content': f"{content}{truncated_note}"})
            current_total += len(content)
        
        parts = [f"Analyze GitHub: {github_url}\n", "Expert analyst persona. Read files carefully.\n"]
        for f in prepared_files:
            parts.append(f"--- File: {f['path']} ---\n{f['content']}\n\n")
        return "".join(parts)
    
    async def evaluate_repository(self, github_url: str, files: List[Dict]) -> Dict:
        if not files: return {"success": False, "error": "No files found"}
        try:
            prompt = self.build_evaluation_prompt(github_url, files)
            res = await self.gemini_service.evaluate_git_repository_structured(prompt)
            if not res.get("success"):
                return {"success": False, "error": res.get("error", {}).get("message", "LLM Unavailable"), "is_llm_fail": True}
            return {"success": True, "result": res.get("response").model_dump()}
        except Exception as e:
            logger.error(f"Error evaluating repo: {e}"); return {"success": False, "error": str(e)}

    def build_grading_prompt(self, github_url: str, files: List[Dict], description: str) -> str:
        per_file_limit = int(os.getenv("GIT_EVAL_PER_FILE_CHAR_LIMIT", "15000"))
        total_limit = int(os.getenv("GIT_EVAL_TOTAL_CHAR_LIMIT", "100000"))
        prepared_files, current_total = [], 0
        for f in files:
            content = str(f.get('content', ''))
            content = content[:per_file_limit]
            if current_total + len(content) > total_limit: break
            prepared_files.append({'path': f.get('path', ''), 'content': content})
            current_total += len(content)
        parts = [f"Analyze GitHub: {github_url}\n", f"User Question/Request:\n{description}\n", "Persona: You are a helpful, conversational Senior Engineer evaluator. Answer the user's question directly and thoroughly based on the code provided. Do not give a numerical score.\n"]
        for f in prepared_files:
            parts.append(f"--- File: {f['path']} ---\n{f['content']}\n\n")
        return "".join(parts)

    async def grade_repository(self, github_url: str, files: List[Dict], description: str) -> Dict:
        if not files or not description: return {"success": False, "error": "Missing input"}
        try:
            prompt = self.build_grading_prompt(github_url, files, description)
            res = await self.gemini_service.grade_git_repository_structured(prompt)
            if not res.get("success"):
                return {"success": False, "error": res.get("error", {}).get("message", "LLM Unavailable"), "is_llm_fail": True}
            return {"success": True, "result": res.get("response").model_dump()}
        except Exception as e:
            logger.error(f"Error grading repo: {e}"); return {"success": False, "error": str(e)}
