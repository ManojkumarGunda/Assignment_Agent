from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import User, AssignmentFile
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
    
    import time
    import asyncio
    start_time = time.time()
    
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
            # Attempt to restore from database
            assignment_file = db.query(AssignmentFile).filter(AssignmentFile.file_id == file_id).first()
            if assignment_file and assignment_file.extracted_text:
                # Determine extension
                ext = ".txt" # Default to text for safety since we only have extracted text
                if assignment_file.original_filename:
                    orig_ext = Path(assignment_file.original_filename).suffix.lower()
                    # Only preserve extension if it's code/text, otherwise valid text extracted from PDF/PPT should be .txt
                    if orig_ext in ['.py', '.js', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.ts', '.html', '.css', '.sql', '.txt', '.md', '.json', '.xml', '.yaml']:
                        ext = orig_ext
                
                restore_path = UPLOAD_DIR / f"{file_id}{ext}"
                try:
                    logger.info(f"Restoring missing file {file_id} from DB as {restore_path.name}")
                    with open(restore_path, "w", encoding="utf-8") as f:
                        f.write(assignment_file.extracted_text)
                    file_path = restore_path
                except Exception as e:
                    logger.error(f"Failed to restore file from DB: {e}")

        if not file_path or not file_path.exists():
            return ReEvaluateResponse(
                success=False,
                result=None,
                error=f"File with ID {file_id} not found. It may have been cleaned up. Please re-upload the file."
            )
        
        # Use original filename from metadata, fallback to file path name
        filename = original_filename or file_path.name
        
        # 🔗 SYNC DESCRIPTION WITH ORIGINAL ASSIGNMENT (CRITICAL FOR DETERMINISM)
        # The original description might contain category tags and reference material 
        # appended during the first evaluation. We must use THAT description to hit the cache.
        final_description = request.description
        assignment_file = db.query(AssignmentFile).filter(AssignmentFile.file_id == file_id).first()
        if assignment_file and assignment_file.assignment:
            original_desc = assignment_file.assignment.description
            # If the provided description is a subset of the original, or if it's effectively 
            # the 'clean' version without tags, use the original one to ensure cache hits.
            if request.description.strip() in original_desc or not request.description.strip():
                logger.info(f"🔄 Re-evaluating {file_id} using original assignment description (includes ref material/tags)")
                final_description = original_desc
        
        # Perform Re-evaluation
        # This will call the LLM and return a fresh score
        result = await re_evaluator.re_evaluate_file(
            file_path=str(file_path),
            title=request.title,
            description=final_description,
            file_id=file_id,
            db=db,
            current_user=current_user
        )
        
        
        elapsed_time = time.time() - start_time
        if elapsed_time < 20:
            wait_time = 20 - elapsed_time
            logger.info(f"⏳ Re-evaluation finished in {elapsed_time:.1f}s. Waiting {wait_time:.1f}s for minimum 20s delta.")
            await asyncio.sleep(wait_time)

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
