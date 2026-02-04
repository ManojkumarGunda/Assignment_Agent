from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from models import EvaluationResult, EvaluationDetail, User
from routers.auth import get_current_user
import logging

router = APIRouter(prefix="/override", tags=["Manual Override"])
logger = logging.getLogger(__name__)

class DetailOverrideRequest(BaseModel):
    detail_id: int
    manual_score: float  # 0.0 to 1.0
    teacher_note: Optional[str] = None

class ResultOverrideRequest(BaseModel):
    result_id: int
    details: List[DetailOverrideRequest]
    overall_note: Optional[str] = None

@router.post("/save")
async def save_override(request: ResultOverrideRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Saves teacher overrides for a student's evaluation result.
    Recalculates the total score_percent based on manual overrides combined with existing AI scores.
    """
    try:
        # 1. Fetch the main evaluation result
        eval_result = db.query(EvaluationResult).filter(EvaluationResult.id == request.result_id).first()
        if not eval_result:
            raise HTTPException(status_code=404, detail="Evaluation result not found")

        # 2. Update the specific details sent in the request
        for detail_req in request.details:
            detail = db.query(EvaluationDetail).filter(EvaluationDetail.id == detail_req.detail_id).first()
            if detail:
                detail.is_overridden = True
                detail.manual_score = detail_req.manual_score
                detail.teacher_note = detail_req.teacher_note
                # Update is_correct based on manual score (>= 0.8 is generally 'Correct')
                detail.is_correct = detail_req.manual_score >= 0.8
        
        db.flush() # Ensure detail updates are visible for recalculation

        # 3. Recalculate global percentage using ALL questions
        all_details = db.query(EvaluationDetail).filter(EvaluationDetail.evaluation_result_id == eval_result.id).all()
        
        total_points = 0.0
        details_count = len(all_details)
        
        for d in all_details:
            # Use manual_score if overridden, else fallback to AI's partial_credit
            score_val = d.manual_score if d.is_overridden else (d.partial_credit if d.partial_credit is not None else (1.0 if d.is_correct else 0.0))
            total_points += score_val
        
        # 4. Update the main result metadata
        eval_result.is_overridden = True
        eval_result.teacher_note = request.overall_note
        
        if details_count > 0:
            new_percent = (total_points / details_count) * 100
            eval_result.score_percent = round(new_percent, 2)
        
        db.commit()
        return {
            "success": True, 
            "message": "Override saved successfully", 
            "new_score": eval_result.score_percent
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Override error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
def health():
    return {"status": "ok", "message": "Override service is active"}
