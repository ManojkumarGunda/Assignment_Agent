from fastapi import APIRouter
from services.gemini_service import GeminiService

router = APIRouter(prefix="/system", tags=["system"])

# Initialize service
gemini_service = GeminiService()


@router.get("/gemini/status")
def check_gemini_status():
    """Check if Gemini AI service is running and available"""
    try:
        is_connected = gemini_service.check_connection()
        models = gemini_service.list_models() if is_connected else []
        
        return {
            "status": "connected" if is_connected else "disconnected",
            "models": models,
            "message": "LLM service is available" if is_connected else "LLM service is not available"
        }
    except Exception as e:
        return {
            "status": "error",
            "models": [],
            "message": f"Error checking LLM status: {str(e)}"
        }
