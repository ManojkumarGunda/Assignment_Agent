from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import User
from auth import get_current_user
from schemas.schemas import (
    GitEvaluateRequest, GitEvaluateResponse,
    GitGradeRequest, GitGradeResponse
)
import logging
from services.github_service import GitHubService
from services.git_evaluator import GitEvaluator
from services.gemini_service import GeminiService

logger = logging.getLogger(__name__)

# Initialize services
github_service = GitHubService()
gemini_service = GeminiService()
git_evaluator = GitEvaluator(gemini_service)

router = APIRouter(prefix="/github", tags=["github"])


@router.post("/evaluate", response_model=GitEvaluateResponse)
async def evaluate_git_repository(
    request: GitEvaluateRequest,
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
