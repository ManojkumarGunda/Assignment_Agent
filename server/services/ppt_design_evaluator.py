"""
PPT Design Evaluator - Evaluate PowerPoint presentation visual design using vision AI
"""
import logging
from typing import Dict, List, Optional
from .gemini_service import GeminiService

logger = logging.getLogger(__name__)


class PPTDesignEvaluator:
    """Evaluate PowerPoint presentation visual design based on slide images"""
    
    def __init__(self, gemini_service: GeminiService):
        self.gemini_service = gemini_service
    
    async def evaluate_design_from_metadata(self, design_description: str, filename: str, total_slides: int) -> Dict:
        """Evaluate design from metadata with standardized retry handling."""
        try:
            if not design_description or design_description.strip().startswith('['):
                error_msg = design_description.strip('[]') if design_description else "No design metadata"
                return {"error": error_msg, "filename": filename}
            
            res = await self.gemini_service.evaluate_ppt_design_structured(design_description, filename, total_slides)
            if not res.get("success"):
                return {
                    "error": res.get("error", {}).get("message", "LLM Unavailable"),
                    "filename": filename,
                    "is_llm_fail": True
                }
            
            evaluation_result = res.get("response")
            evaluation_result['filename'] = filename
            evaluation_result['total_slides_analyzed'] = total_slides
            return evaluation_result
            
        except Exception as e:
            logger.error(f"Error evaluating PPT design: {e}")
            return {"error": str(e), "filename": filename}
    
    async def evaluate_design(self, slide_images_base64: List[str], filename: str) -> Dict:
        """Legacy vision method with updated retry handling."""
        try:
            if not slide_images_base64:
                return {"error": "No images", "filename": filename}
            
            res = await self.gemini_service.evaluate_ppt_design_vision_structured(slide_images_base64)
            if not res.get("success"):
                return {
                    "error": res.get("error", {}).get("message", "LLM Unavailable"),
                    "filename": filename,
                    "is_llm_fail": True
                }
            
            evaluation_result = res.get("response")
            evaluation_result['filename'] = filename
            evaluation_result['total_slides_analyzed'] = len(slide_images_base64)
            return evaluation_result
        except Exception as e:
            logger.error(f"Error in vision design eval: {e}")
            return {"error": str(e), "filename": filename}
    
    def format_design_evaluation_result(self, evaluation_result: Dict) -> str:
        if "error" in evaluation_result:
            return f"Error: {evaluation_result.get('error', 'Unknown error')}"
        parts = [f"File: {evaluation_result.get('filename', 'Unknown')}", f"Slides Analyzed: {evaluation_result.get('total_slides_analyzed', 0)}", ""]
        criteria = {"visual_clarity": "Visual Clarity", "layout_balance": "Layout Balance", "color_consistency": "Color Consistency", "typography": "Typography", "visual_appeal": "Visual Appeal"}
        for key, display in criteria.items():
            if key in evaluation_result:
                c = evaluation_result[key]; parts.append(f"{display} Score: {c.get('score', 'N/A')}/100"); parts.append(f"Feedback: {c.get('feedback', 'N/A')}"); parts.append("")
        if "design_strengths" in evaluation_result:
            parts.append("Design Strengths:"); parts.extend([f"  - {s}" for s in evaluation_result["design_strengths"]]); parts.append("")
        if "design_improvements" in evaluation_result:
            parts.append("Design Improvements:"); parts.extend([f"  - {i}" for i in evaluation_result["design_improvements"]]); parts.append("")
        if "design_summary" in evaluation_result: parts.append(f"Design Summary: {evaluation_result['design_summary']}")
        return "\n".join(parts)
