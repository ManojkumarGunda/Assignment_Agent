from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    token: str
    user: UserResponse


class RegisterResponse(BaseModel):
    message: str
    user: UserResponse


class GenerateRequest(BaseModel):
    title: str
    description: str
    file_ids: List[str]
    reference_file_ids: Optional[List[str]] = []
    github_url: Optional[str] = None
    evaluate_design: Optional[bool] = False  # If True, evaluate visual design instead of content


class GenerateResponse(BaseModel):
    success: bool
    result: Optional[Any] = None
    summary: Optional[str] = None
    scores: Optional[List[dict]] = None
    file_ids: Optional[List[str]] = None  # Store file IDs for re-evaluation
    error: Optional[str] = None


class GitEvaluateRequest(BaseModel):
    github_url: str


class GitEvaluateResponse(BaseModel):
    success: bool
    result: Optional[dict] = None
    error: Optional[str] = None
    raw_response: Optional[str] = None


class GitGradeRequest(BaseModel):
    github_url: str
    description: str


class GitGradeResponse(BaseModel):
    success: bool
    result: Optional[dict] = None
    error: Optional[str] = None
    raw_response: Optional[str] = None


class ReEvaluateRequest(BaseModel):
    file_id: str
    title: str
    description: str


class ReEvaluateResponse(BaseModel):
    success: bool
    result: Optional[dict] = None
    error: Optional[str] = None
