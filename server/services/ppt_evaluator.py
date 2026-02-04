"""
PPT Evaluator - Evaluate PowerPoint presentations using AI
"""
import logging
from typing import Dict, List, Optional
from .gemini_service import GeminiService

logger = logging.getLogger(__name__)


class PPTEvaluator:
    """Evaluate PowerPoint presentations based on text content and structure"""
    
    def __init__(self, gemini_service: GeminiService):
        self.gemini_service = gemini_service
    
    async def evaluate_ppt(self, title: str, description: str, ppt_data: Dict[str, any]) -> Dict:
        """
        Evaluate a single PPT file with error handling.
        """
        try:
            slides_text = ppt_data.get('slides_text', '')
            total_slides = ppt_data.get('total_slides', 0)
            filename = ppt_data.get('filename', 'Unknown')
            
            error_indicators = [
                '[python-pptx library not available',
                '[Error reading PPTX file',
                '[Error reading PPT file',
                '[Error opening PowerPoint',
                '[comtypes library not available',
                '[Unsupported PowerPoint format'
            ]
            
            if any(indicator in slides_text for indicator in error_indicators) or not slides_text:
                return {"error": f"Extraction failure: {filename}", "filename": filename}
            
            # Call Gemini service with standardized retry handling
            res = await self.gemini_service.evaluate_ppt_structured(title, description, total_slides, slides_text)
            if not res.get("success"):
                return {
                    "error": res.get("error", {}).get("message", "LLM Unavailable"),
                    "filename": filename,
                    "is_llm_fail": True
                }
            
            evaluation_result = res.get("response")
            evaluation_result['filename'] = filename
            evaluation_result['total_slides'] = total_slides
            return evaluation_result
            
        except Exception as e:
            logger.error(f"Error evaluating PPT: {e}")
            return {"error": str(e), "filename": ppt_data.get('filename', 'Unknown')}
    
    def format_evaluation_result(self, evaluation_result: Dict) -> str:
        if "error" in evaluation_result:
            return f"Error: {evaluation_result.get('error', 'Unknown error')}"
        parts = [f"File: {evaluation_result.get('filename', 'Unknown')}", f"Total Slides: {evaluation_result.get('total_slides', 0)}", ""]
        criteria = {"content_quality": "Content Quality", "structure": "Structure", "alignment": "Alignment"}
        for key, display in criteria.items():
            if key in evaluation_result:
                c = evaluation_result[key]; parts.append(f"{display} Score: {c.get('score', 'N/A')}/100"); parts.append(f"Feedback: {c.get('feedback', 'N/A')}"); parts.append("")
        if "strengths" in evaluation_result:
            parts.append("Strengths:"); parts.extend([f"  - {s}" for s in evaluation_result["strengths"]]); parts.append("")
        if "improvements" in evaluation_result:
            parts.append("Areas for Improvement:"); parts.extend([f"  - {i}" for i in evaluation_result["improvements"]]); parts.append("")
        if "summary" in evaluation_result: parts.append(f"Summary: {evaluation_result['summary']}")
        return "\n".join(parts)
