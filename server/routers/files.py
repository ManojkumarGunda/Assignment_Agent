from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from models import User
from auth import get_current_user
from schemas.schemas import GenerateRequest, GenerateResponse
import json
import os
import uuid
from pathlib import Path
from database import get_db
import logging

logger = logging.getLogger(__name__)

# Import services
from services.file_processor import FileProcessor
from services.generate_service_complete import GenerateServiceComplete

# Initialize services
file_processor = FileProcessor()
generate_service = GenerateServiceComplete()

# Create uploads directory for temporary file storage
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload")
async def upload_files(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload multiple files temporarily
    Files are stored until generate is called
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    if len(files) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 files allowed")
    
    file_ids = []
    saved_files = {}
    
    try:
        for file in files:
            # Generate unique file ID
            file_id = str(uuid.uuid4())
            
            # Validate file size (max 30MB per file)
            file_content = await file.read()
            if len(file_content) > 30 * 1024 * 1024:  # 30MB
                raise HTTPException(
                    status_code=400,
                    detail=f"File {file.filename} exceeds 30MB limit"
                )
            
            # Save file temporarily
            file_extension = Path(file.filename).suffix
            saved_filename = f"{file_id}{file_extension}"
            file_path = UPLOAD_DIR / saved_filename
            
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
            # Save original filename metadata
            try:
                meta_path = UPLOAD_DIR / f"{file_id}.meta.json"
                with open(meta_path, "w", encoding="utf-8") as m:
                    json.dump({"original_filename": file.filename}, m)
            except Exception:
                pass
            
            file_ids.append(file_id)
            saved_files[file_id] = {
                "filename": file.filename,
                "path": str(file_path),
                "size": len(file_content)
            }
        
        return {
            "success": True,
            "file_ids": file_ids,
            "files": saved_files,
            "message": f"Successfully uploaded {len(files)} file(s)"
        }
    
    except HTTPException:
        # Clean up on error
        for file_id, file_info in saved_files.items():
            file_path = Path(file_info["path"])
            if file_path.exists():
                file_path.unlink()
        raise
    except Exception as e:
        # Clean up on error
        for file_id, file_info in saved_files.items():
            file_path = Path(file_info["path"])
            if file_path.exists():
                file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error uploading files: {str(e)}")


@router.post("/generate", response_model=GenerateResponse)
async def generate_content(
    request: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate content using AI based on description and uploaded files
    Saves assignment and results to database
    """
    return await generate_service.generate_content(request, current_user, db)
