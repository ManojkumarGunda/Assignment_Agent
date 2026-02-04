from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import User, Assignment, EvaluationResult, EvaluationType, AssignmentStatus, EvaluationDetail
from auth import get_current_user
from database import get_db
from schemas.schemas import (
    GitEvaluateRequest, GitEvaluateResponse,
    GitGradeRequest, GitGradeResponse
)
import logging
from services.github_service import GitHubService
from services.git_evaluator import GitEvaluator
from services.gemini_service import GeminiService
import json

logger = logging.getLogger(__name__)

# Initialize services
github_service = GitHubService()
gemini_service = GeminiService()
git_evaluator = GitEvaluator(gemini_service)

router = APIRouter(prefix="/github", tags=["github"])


@router.post("/evaluate", response_model=GitEvaluateResponse)
async def evaluate_git_repository(
    request: GitEvaluateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Evaluate a GitHub repository and provide project information
    """
    try:
        # Fetch repository files
        files = await github_service.fetch_repository_files(request.github_url, max_files=100)
        
        if not files:
            return GitEvaluateResponse(
                success=False,
                result=None,
                error="No files found in repository or unable to access repository"
            )
        
        # Evaluate repository
        evaluation = await git_evaluator.evaluate_repository(request.github_url, files)
        
        # Save to database if successful
        if evaluation.get("success"):
            try:
                # Create Assignment
                repo_name = request.github_url.rstrip('/').split('/')[-1]
                
                assignment = Assignment(
                    user_id=current_user.id,
                    title=f"GitHub Analysis: {repo_name}",
                    description=f"Repo: {request.github_url}",
                    status=AssignmentStatus.COMPLETED,
                    category="git"
                )
                db.add(assignment)
                db.flush()
                
                # Extract results safely
                res = evaluation.get("result", {})
                if isinstance(res, str):
                    try: res = json.loads(res)
                    except: res = {}
                
                # Format the summary for the main result entry
                summary_text = f"Project: {res.get('project_about', 'N/A')}\n\nUse Case: {res.get('project_use', 'N/A')}"
                
                eval_obj = EvaluationResult(
                    assignment_id=assignment.id,
                    assignment_file_id=None,
                    student_name=repo_name,
                    score_percent=100.0, # Complete
                    reasoning=summary_text,
                    summary="Repository Structure Analysis",
                    evaluation_type=EvaluationType.GITHUB,
                    raw_response_data=json.dumps({"github_url": request.github_url})
                )
                db.add(eval_obj)
                db.flush()
                
                # Create structured Q&A details from the analysis
                # 1. Project Overview
                db.add(EvaluationDetail(
                    evaluation_result_id=eval_obj.id,
                    question="Project Overview",
                    student_answer=res.get("project_about", "N/A"),
                    correct_answer="N/A",
                    is_correct=True,
                    feedback="Extracted from repository README/Code",
                    order_index=1
                ))
                
                # 2. Tech Stack
                tech_stack = ", ".join(res.get("technology_stack", []))
                db.add(EvaluationDetail(
                    evaluation_result_id=eval_obj.id,
                    question="Technology Stack",
                    student_answer=tech_stack,
                    correct_answer="N/A",
                    is_correct=True,
                    feedback="Detected languages and frameworks",
                    order_index=2
                ))
                
                # 3. Key Features
                features = "\n- ".join(res.get("features", []))
                db.add(EvaluationDetail(
                    evaluation_result_id=eval_obj.id,
                    question="Key Features",
                    student_answer=f"- {features}",
                    correct_answer="N/A",
                    is_correct=True,
                    feedback="Major functionalities identified",
                    order_index=3
                ))
                
                # 4. Structure
                db.add(EvaluationDetail(
                    evaluation_result_id=eval_obj.id,
                    question="Project Structure",
                    student_answer=res.get("project_structure", "N/A"),
                    correct_answer="N/A",
                    is_correct=True,
                    feedback="File and directory organization",
                    order_index=4
                ))
                
                db.commit()
            except Exception as db_e:
                logger.error(f"Failed to save GitHub evaluation to DB: {db_e}")
                db.rollback()
        
        return GitEvaluateResponse(
            success=True,
            result=evaluation,
            error=None
        )
        
    except Exception as e:
        logger.error(f"Error evaluating GitHub repository: {e}")
        return GitEvaluateResponse(
            success=False,
            result=None,
            error=f"Error evaluating repository: {str(e)}"
        )


@router.post("/grade", response_model=GitGradeResponse)
async def grade_git_repository(
    request: GitGradeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Grade a GitHub repository based on specific requirements/description
    """
    try:
        # Fetch repository files
        files = await github_service.fetch_repository_files(request.github_url, max_files=100)
        
        if not files:
            return GitGradeResponse(
                success=False,
                result=None,
                error="No files found in repository or unable to access repository"
            )
        
        # Grade repository based on description
        grading = await git_evaluator.grade_repository(
            github_url=request.github_url, 
            files=files, 
            description=request.description
        )
        
        # Save to database if successful
        if grading.get("success"):
            try:
                repo_name = request.github_url.rstrip('/').split('/')[-1]
                
                # Create Assignment
                assignment = Assignment(
                    user_id=current_user.id,
                    title=f"GitHub Grading: {repo_name}",
                    description=request.description, # Save formatted description
                    status=AssignmentStatus.COMPLETED,
                    category="git"
                )
                db.add(assignment)
                db.flush()
                
                # Extract results safely
                res = grading.get("result", {})
                if isinstance(res, str):
                    try: res = json.loads(res)
                    except: res = {}

                # Format the Answer (Conversational Response)
                answer_text = res.get("conversational_response", "No response generated.")
                
                # Format Feedback (Analysis details)
                feedback_text = f"Rules Summary: {res.get('rules_summary', 'N/A')}\n\n"
                if res.get("detected_technology_stack"):
                    feedback_text += f"Detected Stack: {', '.join(res.get('detected_technology_stack'))}\n"
                feedback_text += f"\nOverall Comment: {res.get('overall_comment', '')}"
                
                eval_obj = EvaluationResult(
                    assignment_id=assignment.id,
                    assignment_file_id=None,
                    student_name=repo_name,
                    score_percent=0.0,
                    reasoning=answer_text, # Main answer in reasoning
                    summary="GitHub User Query",
                    evaluation_type=EvaluationType.GITHUB,
                    raw_response_data=json.dumps({"github_url": request.github_url})
                )
                db.add(eval_obj)
                db.flush()
                
                # Create a single clear Q&A pair mapping Input -> Output
                detail = EvaluationDetail(
                    evaluation_result_id=eval_obj.id,
                    question=request.description, # USER INPUT (Question)
                    student_answer=answer_text,   # LLM OUTPUT (Answer)
                    correct_answer="N/A",
                    is_correct=True,
                    feedback=feedback_text,       # Technical details
                    order_index=1
                )
                db.add(detail)
                
                db.commit()
            except Exception as db_e:
                logger.error(f"Failed to save GitHub grading to DB: {db_e}")
                db.rollback()

        return GitGradeResponse(
            success=True,
            result=grading,
            error=None
        )
        
    except Exception as e:
        logger.error(f"Error grading GitHub repository: {e}")
        return GitGradeResponse(
            success=False,
            result=None,
            error=f"Error grading repository: {str(e)}"
        )
