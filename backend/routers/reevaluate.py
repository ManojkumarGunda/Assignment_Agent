from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import User
from auth import get_current_user
from schemas.schemas import ReEvaluateRequest, ReEvaluateResponse
from database import get_db
import json
import logging
from pathlib import Path
from services.re_evaluator import ReEvaluator
from services.gemini_service import GeminiService
from services.ppt_evaluator import PPTEvaluator
from services.ppt_design_evaluator import PPTDesignEvaluator

logger = logging.getLogger(__name__)

# Initialize services
# proper initialization with dependencies
gemini_service = GeminiService()
ppt_design_evaluator = PPTDesignEvaluator(gemini_service)
ppt_evaluator = PPTEvaluator(gemini_service)
re_evaluator = ReEvaluator(gemini_service, ppt_evaluator, ppt_design_evaluator)

# Create uploads directory for temporary file storage
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

router = APIRouter(prefix="/reevaluate", tags=["reevaluate"])


@router.post("", response_model=ReEvaluateResponse)
async def reevaluate_single_file(
    request: ReEvaluateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Re-evaluate a single student file based on title and description.
    This endpoint re-processes one uploaded file and returns updated evaluation results.
    Updates the existing evaluation result in the database.
    """
    if not request.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")
    
    if not request.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    
    file_id = request.file_id.strip()
    if not file_id:
        raise HTTPException(status_code=400, detail="File ID is required")
    
    try:
        # Find the file
        file_path = None
        original_filename = None
        
        # Try to get original filename from metadata
        try:
            meta_path = UPLOAD_DIR / f"{file_id}.meta.json"
            if meta_path.exists():
                with open(meta_path, "r", encoding="utf-8") as m:
                    md = json.load(m)
                    if isinstance(md, dict):
                        original_filename = md.get("original_filename")
        except Exception:
            pass
        
        # Find the actual file
        for saved_file in UPLOAD_DIR.glob(f"{file_id}.*"):
            if saved_file.name == f"{file_id}.meta.json":
                continue
            file_path = saved_file
            break
        
        if not file_path or not file_path.exists():
            return ReEvaluateResponse(
                success=False,
                result=None,
                error=f"File with ID {file_id} not found. It may have been cleaned up. Please re-upload the file."
            )
        
        # Use original filename from metadata, fallback to file path name
        filename = original_filename or file_path.name
        
        # Perform Re-evaluation
        # This will call the LLM and return a fresh score
        result = await re_evaluator.re_evaluate_file(
            file_path=str(file_path),
            title=request.title,
            description=request.description,
            file_id=file_id,
            db=db,
            current_user=current_user
        )
        
        return ReEvaluateResponse(
            success=result.get("success", False),
            result=result.get("result"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error during re-evaluation: {e}")
        return ReEvaluateResponse(
            success=False,
            result=None,
            error=f"Error during re-evaluation: {str(e)}"
        )


@router.get("/health")
def check_reevaluate_endpoint():
    """Health check for re-evaluate endpoint"""
    return {
        "status": "ok",
        "endpoint": "/reevaluate",
        "method": "POST",
        "message": "Re-evaluate endpoint is available"
    }
