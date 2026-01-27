"""
Complete Generate Service - Contains ALL evaluation logic from original main.py
This is the COMPLETE implementation with no functionality missed
"""
import json
import re
import os
import uuid
from pathlib import Path
from typing import List, Dict, Optional
import logging
import asyncio
from sqlalchemy.orm import Session

from services.file_processor import FileProcessor
from services.gemini_service import GeminiService
from services.github_service import GitHubService
from services.git_evaluator import GitEvaluator
from services.ppt_processor import PPTProcessor
from services.ppt_evaluator import PPTEvaluator
from services.ppt_design_evaluator import PPTDesignEvaluator
from services.re_evaluator import ReEvaluator
from models import Assignment, AssignmentFile, EvaluationResult, EvaluationDetail, AssignmentStatus, EvaluationType

logger = logging.getLogger(__name__)

# Create uploads directory for temporary file storage
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


class GenerateServiceComplete:
    """Complete service with ALL original evaluation logic"""
    
    def __init__(self):
        self.file_processor = FileProcessor()
        self.gemini_service = GeminiService()
        self.github_service = GitHubService()
        self.git_evaluator = GitEvaluator(self.gemini_service)
        self.ppt_evaluator = PPTEvaluator(self.gemini_service)
        self.ppt_design_evaluator = PPTDesignEvaluator(self.gemini_service)
        self.re_evaluator = ReEvaluator(self.gemini_service, self.ppt_evaluator, self.ppt_design_evaluator)
    
    def calculate_score_from_details(self, details: list, partial_credit: bool = True) -> float:
        """
        Calculate score_percent based on correct/incorrect answers from LLM evaluation
        """
        if not details or not isinstance(details, list) or len(details) == 0:
            return 0.0
        
        total_questions = len(details)
        total_score = 0.0
        
        for idx, detail in enumerate(details):
            if not isinstance(detail, dict):
                continue
            
            # Check if answer is marked as correct
            if detail.get('is_correct') is True or detail.get('is_correct') == True:
                total_score += 1.0
            elif partial_credit and 'partial_credit' in detail:
                try:
                    credit = float(detail.get('partial_credit', 0))
                    credit = max(0.0, min(1.0, credit))
                    total_score += credit
                except (ValueError, TypeError):
                    pass
        
        if total_questions > 0:
            score_percent = (total_score / total_questions) * 100.0
        else:
            score_percent = 0.0
        
        return round(score_percent, 2)
    
    async def extract_qa_pairs(self, text: str) -> List[Dict]:
        """
        Smarter extraction utilizing Gemini structured extraction.
        """
        if not text or not isinstance(text, str) or len(text.strip()) < 10:
            return []

        try:
            logger.info("Performing structured extraction for file content...")
            res = await self.gemini_service.extract_qa_structured(text)

            if not res.get("success"):
                logger.warning(f"Structured extraction failed: {res.get('error')}. Falling back to basic regex.")
                return self._fallback_extract_qa(text)

            extracted_pairs = res.get("response", [])
            
            # Map internal keys back to format expected by evaluator
            for p in extracted_pairs:
                if 'answer' not in p and 'student_answer' in p:
                    p['answer'] = p['student_answer']
            
            logger.info(f"Successfully extracted {len(extracted_pairs)} QA pairs.")
            return extracted_pairs

        except Exception as e:
            logger.error(f"Error in extraction: {e}")
            return self._fallback_extract_qa(text)

    def _fallback_extract_qa(self, text: str) -> List[Dict]:
        """Basic regex-based extraction as a safety fallback."""
        qa = []
        lines = [l.rstrip() for l in text.splitlines()]
        question_re = re.compile(r"^\s*(?:Question\s*\d+|Q\d+|Q|Qus|Ques)\s*[:\.\)]", flags=re.IGNORECASE)
        current_q = None
        current_a = []
        
        for line in lines:
            if question_re.search(line):
                if current_q:
                    qa.append({"question": current_q, "answer": "\n".join(current_a).strip() or None})
                current_q = question_re.sub("", line).strip()
                current_a = []
            else:
                current_a.append(line)
        if current_q:
            qa.append({"question": current_q, "answer": "\n".join(current_a).strip() or None})
        return qa
    
    async def generate_content(self, request, current_user, db: Optional[Session] = None):
        """Complete generate content method"""
        if not request.description.strip():
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Description is required")
        
        github_url = request.github_url or None
        if not github_url and "github.com" in (request.description or "").lower():
            github_match = re.search(r'https?://github\.com/[\w\-\.]+/[\w\-\.]+', request.description)
            if github_match: github_url = github_match.group(0)
        
        if not request.file_ids and not github_url:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Provide at least one file or GitHub URL")
        
        try:
            file_contents = []
            file_paths_to_cleanup = []
            file_basenames = []
            file_ids_by_index = []
            
            if github_url:
                github_files = await self.github_service.fetch_repository_files(github_url, max_files=100)
                for gh_file in github_files:
                    path_obj = Path(gh_file['path'])
                    file_contents.append({
                        'filename': gh_file['name'],
                        'content': gh_file['content'],
                        'file_type': 'github',
                        'extension': path_obj.suffix.lower(),
                        'path': gh_file['path']
                    })
                    file_basenames.append(path_obj.stem)
            
            for file_id in request.file_ids:
                file_path = None
                original_filename = None
                for saved_file in UPLOAD_DIR.glob(f"{file_id}.*"):
                    if saved_file.name == f"{file_id}.meta.json": continue
                    file_path = saved_file
                    break
                
                if not file_path: continue
                
                try:
                    meta_path = UPLOAD_DIR / f"{file_id}.meta.json"
                    if meta_path.exists():
                        with open(meta_path, "r", encoding="utf-8") as m:
                            md = json.load(m)
                            original_filename = md.get("original_filename")
                except Exception: pass

                file_data = self.file_processor.read_file(str(file_path))
                if original_filename: file_data['filename'] = original_filename
                # determine display name (Student Name)
                extracted_name = FileProcessor.extract_name_from_content(file_data.get('content', ''))
                fallback_name = Path(original_filename or file_path.name).stem
                
                # Use extracted name if found, otherwise use filename
                final_display_name = extracted_name if extracted_name else fallback_name
                
                # IMPORTANT: Save back to file_data so it travels with the obj
                file_data['display_name'] = final_display_name
                
                file_contents.append(file_data)
                file_paths_to_cleanup.append(file_path)
                file_ids_by_index.append(file_id)
                file_basenames.append(final_display_name)
            
            # PPT Logic
            all_ppt_files = all(fd.get('file_type') == 'ppt' for fd in file_contents)
            if all_ppt_files and file_contents:
                ppt_tasks = []
                for i, fd in enumerate(file_contents):
                    file_path = str(file_paths_to_cleanup[i])
                    ppt_tasks.append(self._evaluate_single_ppt(fd, file_path, file_ids_by_index[i], request.title, request.description))
                
                ppt_results = await asyncio.gather(*ppt_tasks, return_exceptions=True)
                final_scores = []
                final_result_parts = []
                
                for i, result in enumerate(ppt_results):
                    if isinstance(result, Exception) or (isinstance(result, dict) and "error" in result and result.get("is_llm_fail")):
                        err_info = result.get("error") if isinstance(result, dict) else str(result)
                        final_scores.append({
                            "name": file_contents[i].get('display_name', 'Unknown'),
                            "file_id": file_ids_by_index[i],
                            "score_percent": 0.0,
                            "reasoning": "Evaluation could not be completed because the LLM service was temporarily unavailable. Please try again later.",
                            "details": [],
                            "error": err_info
                        })
                        final_result_parts.append(f"LLM Unavailable for {file_contents[i].get('filename')}")
                    else:
                        final_scores.append(result['score'])
                        final_result_parts.append(result['formatted'])
                
                assignment_id = None
                if db:
                    assignment_id = self._save_to_database(db, current_user, request, file_contents, file_basenames, file_ids_by_index, file_paths_to_cleanup, final_scores, "PPT Evaluation Complete", EvaluationType.PPT)
                
                return {"success": True, "result": "\n\n".join(final_result_parts), "scores": final_scores, "file_ids": file_ids_by_index, "assignment_id": assignment_id}

            return await self.evaluate_with_complete_logic(request, file_contents, file_basenames, {}, file_ids_by_index, file_paths_to_cleanup, current_user, db)
            
        except Exception as e:
            logger.error(f"Error: {e}", exc_info=True)
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=str(e))
    
    async def evaluate_with_complete_logic(self, request, file_contents, file_basenames, file_ids_map, file_ids_by_index, file_paths_to_cleanup=None, current_user=None, db: Optional[Session] = None):
        """Standard evaluation with per-question deterministic logic & robust error handling."""
        try:
            prepared = []
            for idx, fd in enumerate(file_contents):
                content = str(fd.get('content', ''))
                qa_pairs = await self.extract_qa_pairs(content)
                
                # FALLBACK: If no QA pairs were found (common for code files or simple essays),
                # treat the entire content as a single answer to the assignment prompt.
                if not qa_pairs:
                    logger.info(f"No QA pairs extracted for {file_basenames[idx]}. Falling back to whole-file evaluation.")
                    qa_pairs = [{
                        "question": request.title or "Evaluate the submitted assignment/code against the requirements.",
                        "student_answer": content
                    }]
                
                fd_copy = dict(fd)
                fd_copy['qa_pairs'] = qa_pairs
                fd_copy['display_name'] = file_basenames[idx] if idx < len(file_basenames) else 'Unknown'
                fd_copy['file_id'] = file_ids_by_index[idx] if idx < len(file_ids_by_index) else None
                prepared.append(fd_copy)
            
            async def evaluate_file(fd):
                details = []
                qa_pairs = fd.get('qa_pairs', [])
                
                eval_tasks = []
                for qa in qa_pairs:
                    question = qa.get('question', '')
                    answer = qa.get('answer') or qa.get('student_answer', '')
                    eval_tasks.append(self.gemini_service.evaluate_one_qa(request.description, question, answer))
                
                eval_results = await asyncio.gather(*eval_tasks)
                
                for res in eval_results:
                    if not res.get("success"):
                        # Graceful failure handling for LLM unavailability
                        return {
                            "name": fd['display_name'],
                            "file_id": fd['file_id'],
                            "score_percent": 0.0,
                            "reasoning": "Evaluation could not be completed because the LLM service was temporarily unavailable. Please try again later.",
                            "details": [],
                            "error": res.get("error")
                        }
                    
                    detail_model = res.get("response")
                    details.append(detail_model.model_dump())
                
                score_percent = self.calculate_score_from_details(details)
                return {
                    "name": fd['display_name'],
                    "file_id": fd['file_id'],
                    "reasoning": "Auto-computed from per-question evaluation.",
                    "details": details,
                    "score_percent": score_percent,
                }

            file_tasks = [evaluate_file(fd) for fd in prepared]
            final_scores = await asyncio.gather(*file_tasks)
            
            assignment_id = None
            if db:
                assignment_id = self._save_to_database(db, current_user, request, file_contents, file_basenames, file_ids_by_index, file_paths_to_cleanup or [], final_scores, "File Evaluation Complete", EvaluationType.FILE)
            
            return {"success": True, "result": json.dumps({"scores": final_scores}, indent=2), "scores": final_scores, "file_ids": file_ids_by_index, "assignment_id": assignment_id}

        except Exception as e:
            logger.error(f"Eval error: {e}")
            return {"success": False, "error": str(e)}

    async def _evaluate_single_ppt(self, fd: Dict, file_path: str, file_id: str, title: str, description: str) -> Dict:
        """Evaluate single PPT with error handling."""
        res_info = await self.ppt_evaluator.evaluate_ppt(title, description, {'slides_text': fd.get('content'), 'filename': fd.get('filename')})
        if "error" in res_info and res_info.get("is_llm_fail"): return {"error": res_info["error"], "is_llm_fail": True}
        
        design_meta = PPTProcessor.extract_design_metadata(file_path)
        design_res = await self.ppt_design_evaluator.evaluate_design_from_metadata(design_meta.get('design_description', ''), fd.get('filename'), design_meta.get('total_slides', 0))
        if "error" in design_res and design_res.get("is_llm_fail"): return {"error": design_res["error"], "is_llm_fail": True}
        
        formatted = self.ppt_evaluator.format_evaluation_result(res_info)
        formatted += "\nVisual Design:\n" + self.ppt_design_evaluator.format_design_evaluation_result(design_res)
        
        avg_score = 0
        try:
            pts = [res_info.get(k, {}).get('score', 0) for k in ['content_quality', 'structure', 'alignment']]
            avg_score = sum(pts) / len(pts) if pts else 0
        except: pass

        score = {
            "name": fd.get('display_name', 'Unknown'),
            "file_id": file_id,
            "score_percent": avg_score,
            "reasoning": res_info.get('summary', ''),
            "details": res_info.get("details", []),
            "ppt_content": res_info,
            "design_evaluation": design_res
        }
        return {"score": score, "formatted": formatted}

    def _save_to_database(self, db: Session, current_user, request, file_contents, file_basenames, file_ids_by_index, file_paths_to_cleanup, final_scores, summary, evaluation_type) -> Optional[int]:
        try:
            # Map EvaluationType to category string
            category_map = {
                EvaluationType.FILE: 'file_upload',
                EvaluationType.PPT: 'ppt',
                EvaluationType.GITHUB: 'git'
            }
            category = category_map.get(evaluation_type, 'file_upload')
            
            assignment = Assignment(
                user_id=current_user.id, 
                title=request.title, 
                description=request.description, 
                status=AssignmentStatus.COMPLETED,
                category=category
            )
            db.add(assignment); db.flush()
            
            file_objs = {}
            for idx, fd in enumerate(file_contents):
                if idx >= len(file_ids_by_index): continue
                f_id = file_ids_by_index[idx]
                f_obj = AssignmentFile(assignment_id=assignment.id, file_id=f_id, original_filename=fd.get('filename', ''), extracted_text=str(fd.get('content'))[:50000], extracted_name=file_basenames[idx], file_type=fd.get('file_type', 'unknown'))
                db.add(f_obj); file_objs[f_id] = f_obj
            db.flush()

            for score in final_scores:
                f_id = score.get('file_id')
                f_obj = file_objs.get(f_id)
                ev = EvaluationResult(assignment_id=assignment.id, assignment_file_id=f_obj.id if f_obj else None, student_name=score.get('name', 'Unknown'), score_percent=float(score.get('score_percent', 0)), reasoning=score.get('reasoning', ''), evaluation_type=evaluation_type)
                db.add(ev); db.flush()
                for d_idx, d in enumerate(score.get('details', [])):
                    db.add(EvaluationDetail(evaluation_result_id=ev.id, question=d.get('question', 'N/A'), student_answer=d.get('student_answer', 'N/A'), correct_answer=d.get('correct_answer', 'N/A'), is_correct=bool(d.get('is_correct')), feedback=d.get('feedback', 'N/A'), order_index=d_idx))
            db.commit()
            return assignment.id
        except Exception as e:
            db.rollback(); logger.error(f"DB Error: {e}"); return None
