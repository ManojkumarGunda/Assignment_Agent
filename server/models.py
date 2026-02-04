from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # Relationships
    assignments = relationship("Assignment", back_populates="user", cascade="all, delete-orphan")


class AssignmentStatus(str, enum.Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(SQLEnum(AssignmentStatus), default=AssignmentStatus.DRAFT, nullable=False)
    category = Column(String, nullable=True)  # 'file_upload', 'ppt', 'git'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="assignments")
    files = relationship("AssignmentFile", back_populates="assignment", cascade="all, delete-orphan")
    evaluation_results = relationship("EvaluationResult", back_populates="assignment", cascade="all, delete-orphan")


class AssignmentFile(Base):
    __tablename__ = "assignment_files"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)
    file_id = Column(String, nullable=False, index=True)  # UUID matching current file_id system
    original_filename = Column(String, nullable=False)
    extracted_text = Column(Text, nullable=True)  # Store full extracted content
    extracted_name = Column(String, nullable=True)  # Name extracted from file content
    file_type = Column(String, nullable=False)  # 'pdf', 'docx', 'txt', 'ppt', etc.
    file_size = Column(Integer, nullable=True)  # Size in bytes
    file_path = Column(String, nullable=True)  # Path to stored file
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    assignment = relationship("Assignment", back_populates="files")
    evaluation_results = relationship("EvaluationResult", back_populates="assignment_file", cascade="all, delete-orphan")


class EvaluationType(str, enum.Enum):
    FILE = "file"
    PPT = "ppt"
    GITHUB = "github"


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)
    assignment_file_id = Column(Integer, ForeignKey("assignment_files.id"), nullable=True, index=True)
    student_name = Column(String, nullable=False)  # Extracted name or basename
    score_percent = Column(Float, nullable=False)  # 0-100
    reasoning = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)  # Overall summary
    evaluation_type = Column(SQLEnum(EvaluationType), default=EvaluationType.FILE, nullable=False)
    
    # JSON fields for complex nested data
    ppt_content_data = Column(Text, nullable=True)  # JSON string for PPT content evaluation
    design_evaluation_data = Column(Text, nullable=True)  # JSON string for PPT design data
    raw_response_data = Column(Text, nullable=True)  # JSON string of original AI response
    
    # Manual Override fields
    is_overridden = Column(Boolean, default=False)
    teacher_note = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    assignment = relationship("Assignment", back_populates="evaluation_results")
    assignment_file = relationship("AssignmentFile", back_populates="evaluation_results")
    details = relationship("EvaluationDetail", back_populates="evaluation_result", cascade="all, delete-orphan", order_by="EvaluationDetail.order_index")


class EvaluationDetail(Base):
    __tablename__ = "evaluation_details"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_result_id = Column(Integer, ForeignKey("evaluation_results.id"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    student_answer = Column(Text, nullable=True)
    correct_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=False, default=False)
    partial_credit = Column(Float, nullable=True)  # 0-1 fractional credit
    concept_match = Column(Float, nullable=True)  # 0-100 concept match score
    feedback = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)  # To preserve question order
    
    # Manual Override fields
    is_overridden = Column(Boolean, default=False)
    manual_score = Column(Float, nullable=True)
    teacher_note = Column(Text, nullable=True)
    
    # Relationships
    evaluation_result = relationship("EvaluationResult", back_populates="details")

