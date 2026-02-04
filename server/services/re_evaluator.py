"""
Re-Evaluator Service
Handles re-evaluation of individual student files based on title and description
"""
import os
import json
import re
import logging
import asyncio
from typing import Dict, List, Optional, Any, TYPE_CHECKING
from sqlalchemy.orm import Session
from .file_processor import FileProcessor
from .gemini_service import GeminiService
from .ppt_processor import PPTProcessor
from .ppt_evaluator import PPTEvaluator
from .ppt_design_evaluator import PPTDesignEvaluator
from models import AssignmentFile, EvaluationResult, EvaluationDetail, EvaluationType
from pathlib import Path

if TYPE_CHECKING:
    from models import User

logger = logging.getLogger(__name__)


class ReEvaluator:
    """Service for re-evaluating individual student files"""
    
    def __init__(self, gemini_service: GeminiService, ppt_evaluator: PPTEvaluator, ppt_design_evaluator: PPTDesignEvaluator):
        self.gemini_service = gemini_service
        self.ppt_evaluator = ppt_evaluator
        self.ppt_design_evaluator = ppt_design_evaluator
        self.file_processor = FileProcessor()
    
    def calculate_score_from_details(self, details: list, partial_credit: bool = True) -> float:
        """Calculate weighted score percent."""
        if not details or not isinstance(details, list) or len(details) == 0:
            return 0.0
        
        total_possible = 0.0
        total_earned = 0.0
        
        for detail in details:
            if not isinstance(detail, dict): continue
            
            # Weighted scoring
            max_m = float(detail.get('max_marks', 1.0))
            if max_m <= 0: max_m = 1.0
            total_possible += max_m
            
            norm_score = 0.0
            if detail.get('is_correct') is True: norm_score = 1.0
            elif partial_credit and 'partial_credit' in detail:
                try:
                    norm_score = max(0.0, min(1.0, float(detail.get('partial_credit', 0))))
                except: pass
            
            total_earned += (norm_score * max_m)
            
        return round((total_earned / total_possible) * 100.0, 2) if total_possible > 0 else 0.0
    
    async def extract_qa_pairs(self, text: str) -> List[Dict]:
        """Extract QA pairs with error handling."""
        if not text or not isinstance(text, str) or len(text.strip()) < 10: return []
        try:
            res = await self.gemini_service.extract_qa_structured(text)
            if not res.get("success"):
                logger.warning(f"Structured extraction failed: {res.get('error')}. Falling back.")
                return self._fallback_extract_qa(text)
            extracted_pairs = res.get("response", [])
            for p in extracted_pairs:
                if 'answer' not in p and 'student_answer' in p: p['answer'] = p['student_answer']
            return extracted_pairs
        except Exception as e:
            logger.error(f"Error in extraction: {e}")
            return self._fallback_extract_qa(text)

    def _fallback_extract_qa(self, text: str) -> list:
        qa = []
        lines = [l.rstrip() for l in text.splitlines()]
        question_re = re.compile(r"^\s*(?:Question\s*\d+|Q\d+|Q|Qus|Ques)\s*[:\.\)]", flags=re.IGNORECASE)
        current_q, current_a = None, []
        for line in lines:
            if question_re.search(line):
                if current_q: qa.append({"question": current_q, "answer": "\n".join(current_a).strip() or None})
                current_q = question_re.sub("", line).strip(); current_a = []
            else: current_a.append(line)
        if current_q: qa.append({"question": current_q, "answer": "\n".join(current_a).strip() or None})
        return qa
    
    async def re_evaluate_file(self, file_path: str, title: str, description: str, file_id: Optional[str] = None, db: Optional[Session] = None, current_user: Optional["User"] = None) -> Dict:
        try:
            file_type_res = self.file_processor.read_file(file_path)
            
            # ATTEMPT TO RESTORE ORIGINAL FILENAME via meta file
            original_filename = None
            if file_id:
                try:
                    meta_path = Path("uploads") / f"{file_id}.meta.json"
                    if meta_path.exists():
                        with open(meta_path, "r", encoding="utf-8") as m:
                            md = json.load(m)
                            original_filename = md.get("original_filename")
                except Exception: 
                    pass
            
            # Fallback to current file path name if metadata lookup fails
            filename = original_filename or file_type_res.get('filename') or os.path.basename(file_path)
            
            if os.path.splitext(filename)[1].lower() in ['.ppt', '.pptx']:
                return await self._re_evaluate_ppt(file_path, filename, title, description, file_id, db)
            
            content = str(file_type_res.get('content', ''))
            qa_pairs = await self.extract_qa_pairs(content)
            
            # FALLBACK: If no QA pairs were found (common for code files or simple essays),
            # treat the entire content as a single answer to the assignment prompt.
            if not qa_pairs:
                logger.info(f"No QA pairs extracted during re-evaluation. Falling back to whole-file evaluation.")
                qa_pairs = [{
                    "question": "Evaluate the submitted assignment/code strictly against the provided requirements/description.",
                    "answer": content
                }]
                
            teacher_prefs = ""
            if db and file_id:
                assignment_file = db.query(AssignmentFile).filter_by(file_id=file_id).first()
                if assignment_file:
                    overrides = db.query(EvaluationDetail).join(EvaluationResult).filter(
                        EvaluationResult.assignment_id == assignment_file.assignment_id,
                        EvaluationDetail.is_overridden == True
                    ).order_by(EvaluationDetail.id).all()
                    if overrides:
                        pref_list = []
                        for ovr in overrides:
                            pref_list.append(f"- For question '{ovr.question[:50]}...', the teacher assigned a score of {ovr.manual_score}. Note: {ovr.teacher_note or 'No note'}")
                        teacher_prefs = "\n".join(pref_list[:10])
            
            display_name = FileProcessor.extract_name_from_content(content) or os.path.splitext(filename)[0]

            eval_tasks = []
            for idx_q, qa in enumerate(qa_pairs, 1):
                eval_tasks.append(self.gemini_service.evaluate_one_qa(description, qa.get('question', ''), qa.get('answer') or qa.get('student_answer', ''), question_index=idx_q, teacher_preferences=teacher_prefs))
            
            eval_results = await asyncio.gather(*eval_tasks)
            details = []
            for res in eval_results:
                if not res.get("success"):
                    return {
                        "success": False, 
                        "error": "LLM service unavailable. Please try again later.",
                        "reasoning": "LLM Unavailable during re-evaluation."
                    }
                details.append(res.get("response"))
            
            score_result = {
                'name': display_name,
                'score_percent': self.calculate_score_from_details(details),
                'reasoning': "Auto-computed from per-question re-evaluation.",
                'details': details
            }
            if db and file_id: self._update_database_re_evaluation(db, file_id, score_result, "Re-evaluation complete.", filename, display_name)
            return {"success": True, "result": score_result, "summary": "Re-evaluation complete."}
        except Exception as e:
            logger.error(f"Re-evaluation error: {e}"); return {"success": False, "error": str(e)}
    
    async def _re_evaluate_ppt(self, file_path: str, filename: str, title: str, description: str, file_id: Optional[str] = None, db: Optional[Session] = None) -> Dict:
        try:
            ppt_result = PPTProcessor.process_ppt_file(file_path)
            display_name = FileProcessor.extract_name_from_content(ppt_result.get('slides_text', '')) or os.path.splitext(filename)[0]
            
            eval_res = await self.ppt_evaluator.evaluate_ppt(title, description, ppt_result)
            if "error" in eval_res and eval_res.get("is_llm_fail"): return {"success": False, "error": "LLM service unavailable."}
            
            design_meta = PPTProcessor.extract_design_metadata(file_path)
            design_res = await self.ppt_design_evaluator.evaluate_design_from_metadata(design_meta.get('design_description', ''), filename, design_meta.get('total_slides', 0))
            if "error" in design_res and design_res.get("is_llm_fail"): return {"success": False, "error": "LLM service unavailable."}

            formatted_res = [self.ppt_evaluator.format_evaluation_result(eval_res), "\nVisual Design:\n" + self.ppt_design_evaluator.format_design_evaluation_result(design_res)]
            pts = [eval_res.get(k, {}).get('score', 0) for k in ['content_quality', 'structure', 'alignment']]
            score_percent = sum(pts) / len(pts) if pts else 0

            result_data = {
                'name': display_name, 'score_percent': round(score_percent, 2),
                'reasoning': eval_res.get('summary', 'PPT Re-evaluation complete.'),
                'details': eval_res.get('details', []), 'ppt_content': eval_res,
                'design_evaluation': design_res, 'formatted_result': "\n".join(formatted_res)
            }
            if db and file_id:
                self._update_database_re_evaluation(db, file_id, result_data, result_data.get('reasoning', ''), filename, display_name, ppt_content_data=json.dumps(eval_res), design_evaluation_data=json.dumps(design_res))
            return {"success": True, "result": result_data, "summary": result_data.get('reasoning')}
        except Exception as e:
            logger.error(f"Error in PPT re-evaluation: {e}"); return {"success": False, "error": str(e)}

    def _update_database_re_evaluation(self, db: Session, file_id: str, score_result: Dict, summary: str, filename: str, student_name: str, ppt_content_data: Optional[str] = None, design_evaluation_data: Optional[str] = None):
        try:
            assignment_file = db.query(AssignmentFile).filter_by(file_id=file_id).first()
            if not assignment_file: return
            evaluation_result = db.query(EvaluationResult).filter_by(assignment_file_id=assignment_file.id).first()
            if not evaluation_result:
                evaluation_result = EvaluationResult(assignment_id=assignment_file.assignment_id, assignment_file_id=assignment_file.id, student_name=student_name, score_percent=float(score_result.get('score_percent', 0)), reasoning=score_result.get('reasoning', ''), summary=summary, evaluation_type=EvaluationType.PPT if ppt_content_data else EvaluationType.FILE, ppt_content_data=ppt_content_data, design_evaluation_data=design_evaluation_data)
                db.add(evaluation_result); db.flush()
            else:
                evaluation_result.student_name = student_name or evaluation_result.student_name; evaluation_result.score_percent = float(score_result.get('score_percent', 0)); evaluation_result.reasoning = score_result.get('reasoning', ''); evaluation_result.summary = summary
                if ppt_content_data: evaluation_result.ppt_content_data = ppt_content_data
                if design_evaluation_data: evaluation_result.design_evaluation_data = design_evaluation_data
            db.query(EvaluationDetail).filter_by(evaluation_result_id=evaluation_result.id).delete()
            details = score_result.get('details', [])
            for idx, detail in enumerate(details):
                if not isinstance(detail, dict): continue
                db.add(EvaluationDetail(evaluation_result_id=evaluation_result.id, question=detail.get('question', 'Not available'), student_answer=detail.get('student_answer', 'Not available'), correct_answer=detail.get('correct_answer', 'Not available'), is_correct=bool(detail.get('is_correct', False)), partial_credit=detail.get('partial_credit'), feedback=detail.get('feedback', 'Not available'), order_index=idx))
            db.commit()
        except Exception as e:
            db.rollback(); logger.error(f"Error updating database: {e}"); raise
