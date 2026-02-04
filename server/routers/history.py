from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Assignment, User, EvaluationResult
from auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history", tags=["history"])

@router.get("")
@router.get("/")
def get_history(
    category: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's assignment history with optional category filtering and pagination.
    """
    try:
        query = db.query(Assignment).filter(Assignment.user_id == current_user.id)
        
        if category:
            query = query.filter(Assignment.category == category)
        
        # Count total for pagination
        total = query.count()
        
        # Apply ordering, offset and limit
        assignments = query.order_by(Assignment.created_at.desc()) \
            .offset((page - 1) * limit) \
            .limit(limit) \
            .all()
        
        # Prepare response
        result = []
        for a in assignments:
            # Get primary evaluation result for quick display (e.g. score and student name)
            main_result = db.query(EvaluationResult).filter(EvaluationResult.assignment_id == a.id).first()
            
            # Formatting date to string for reliable frontend display
            # Append 'Z' to indicate UTC time so the frontend can convert it to local time
            date_str = a.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if a.created_at else "N/A"
            
            result.append({
                "id": a.id,
                "title": a.title,
                "description": a.description,
                "category": a.category,
                "status": a.status,
                "created_at": date_str,
                "student_name": main_result.student_name if main_result else "Unknown",
                "score": main_result.score_percent if main_result else 0
            })
            
        return {
            "success": True,
            "data": result,
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "total_pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch history")

@router.get("/download/{file_id}")
def download_assignment_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download an assignment file by its file_id (UUID).
    Verifies that the file belongs to an assignment owned by the current user.
    """
    from models import AssignmentFile
    from fastapi.responses import FileResponse
    import os
    from pathlib import Path

    # Security check: Ensure the file belongs to the user via Assignment link
    file_record = db.query(AssignmentFile).join(Assignment).filter(
        AssignmentFile.file_id == file_id,
        Assignment.user_id == current_user.id
    ).first()

    if not file_record:
        raise HTTPException(status_code=404, detail="File record not found or access denied")

    # Find the physical file in uploads directory
    UPLOAD_DIR = Path("uploads")
    # File could have any extension (.pdf, .docx, .txt, etc)
    matching_files = list(UPLOAD_DIR.glob(f"{file_id}.*"))
    
    # Filter out .meta.json files
    target_file = None
    for f in matching_files:
        if f.suffix != ".json":
            target_file = f
            break
            
    if not target_file or not target_file.exists():
        raise HTTPException(status_code=404, detail="Physical file not found on server")

    return FileResponse(
        path=target_file,
        filename=file_record.original_filename,
        media_type="application/octet-stream"
    )

@router.get("/download-report/{evaluation_result_id}")
def download_evaluation_report(
    evaluation_result_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download evaluation report as PDF.
    """
    from services.report_service import ReportService
    from models import EvaluationDetail, EvaluationResult, Assignment
    from fastapi.responses import FileResponse
    
    result = db.query(EvaluationResult).filter(EvaluationResult.id == evaluation_result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Evaluation result not found")
        
    # Check permissions via assignment
    assignment = db.query(Assignment).filter(Assignment.id == result.assignment_id).first()
    if not assignment or assignment.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Access denied")

    details = db.query(EvaluationDetail).filter(EvaluationDetail.evaluation_result_id == result.id).order_by(EvaluationDetail.order_index).all()
    
    try:
        report_service = ReportService()
        path = report_service.generate_pdf_report(result, details)
        
        return FileResponse(
            path=path,
            filename=f"Report_{result.student_name}.pdf",
            media_type="application/pdf"
        )
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.get("/{assignment_id}")
def get_assignment_detail(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed results for a specific assignment.
    """
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.user_id == current_user.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    results = db.query(EvaluationResult).filter(EvaluationResult.assignment_id == assignment.id).all()
    
    detailed_results = []
    for r in results:
        # Get per-question details
        from models import EvaluationDetail, AssignmentFile
        details = db.query(EvaluationDetail).filter(EvaluationDetail.evaluation_result_id == r.id).order_by(EvaluationDetail.order_index).all()
        
        # Get associated file_id for downloading
        file_obj = db.query(AssignmentFile).filter(AssignmentFile.id == r.assignment_file_id).first()
        
        detailed_results.append({
            "id": r.id,
            "student_name": r.student_name,
            "score_percent": r.score_percent,
            "reasoning": r.reasoning,
            "summary": r.summary,
            "evaluation_type": r.evaluation_type,
            "is_overridden": r.is_overridden,
            "teacher_note": r.teacher_note,
            "file_id": file_obj.file_id if file_obj else None,
            "details": [
                {
                    "id": d.id,
                    "question": d.question,
                    "student_answer": d.student_answer,
                    "correct_answer": d.correct_answer,
                    "is_correct": d.is_correct,
                    "partial_credit": d.partial_credit,
                    "score": d.manual_score if d.is_overridden else d.partial_credit,
                    "manual_score": d.manual_score,
                    "teacher_note": d.teacher_note,
                    "is_overridden": d.is_overridden,
                    "feedback": d.feedback
                } for d in details
            ]
        })
        
    return {
        "success": True,
        "data": {
            "id": assignment.id,
            "title": assignment.title,
            "description": assignment.description,
            "category": assignment.category,
            "created_at": assignment.created_at,
            "results": detailed_results
        }
    }

@router.delete("/{assignment_id}")
def delete_history(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete an assignment history record (only if it belongs to the current user).
    """
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.user_id == current_user.id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment history not found"
        )
    
    try:
        db.delete(assignment)
        db.commit()
        return {"success": True, "message": "History record deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting history: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete history record")


@router.get("/download-report/{evaluation_result_id}")
def download_evaluation_report(
    evaluation_result_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download evaluation report as PDF.
    """
    from services.report_service import ReportService
    from models import EvaluationDetail, EvaluationResult, Assignment  # Ensure imports
    from fastapi.responses import FileResponse
    
    result = db.query(EvaluationResult).filter(EvaluationResult.id == evaluation_result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Evaluation result not found")
        
    # Check permissions via assignment
    assignment = db.query(Assignment).filter(Assignment.id == result.assignment_id).first()
    if not assignment or assignment.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Access denied")

    details = db.query(EvaluationDetail).filter(EvaluationDetail.evaluation_result_id == result.id).order_by(EvaluationDetail.order_index).all()
    
    report_service = ReportService()
    path = report_service.generate_pdf_report(result, details)
    
    return FileResponse(
        path=path,
        filename=f"Report_{result.student_name}.pdf",
        media_type="application/pdf"
    )


