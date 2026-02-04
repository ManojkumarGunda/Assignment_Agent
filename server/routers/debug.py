from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import User
from auth import get_current_user
from services.file_processor import FileProcessor
from services.gemini_service import GeminiService
from services.determinism_config import DeterministicEvalConfig, EvaluationCache
import re
import asyncio
from pathlib import Path

router = APIRouter(prefix="/debug", tags=["debug"])

# Initialize file processor
file_processor = FileProcessor()

# Create uploads directory for temporary file storage
UPLOAD_DIR = Path("uploads")

@router.get("/extracted/{file_id}")
def debug_extracted(file_id: str, current_user: User = Depends(get_current_user)):
    """Return the extracted text and a quick QA hint for a given uploaded file id for debugging extraction issues."""
    file_path = None
    for saved_file in UPLOAD_DIR.glob(f"{file_id}.*"):
        if saved_file.name == f"{file_id}.meta.json":
            continue
        file_path = saved_file
        break

    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File with ID {file_id} not found")

    file_data = file_processor.read_file(str(file_path))
    content = file_data.get('content', '') or ''

    # Quick QA extractor (same heuristics as the main batch pipeline)
    def extract_qa_pairs_local(text: str):
        qa = []
        if not text or not isinstance(text, str):
            return qa
        lines = [l.rstrip() for l in text.splitlines()]
        i = 0
        question_re = re.compile(r"^\s*(?:Question\b[:\s]*|Q\d*[:\s]*|Q\d+\b|\d+\s*[\.)\-:])", flags=re.IGNORECASE)
        answer_marker_re = re.compile(r"\bAnswer\b[:\s]*", flags=re.IGNORECASE)

        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue
            if '\t' in line:
                cells = [c.strip() for c in line.split('\t')]
                lc = [c.lower() for c in cells]
                if any('question' in c for c in lc) or any('answer' in c for c in lc) or any('q' == c for c in lc):
                    q = cells[0]
                    a = cells[1] if len(cells) > 1 else ''
                    qa.append({'question': q, 'answer': a})
                    i += 1
                    continue
            if question_re.search(line) or '?' in line:
                qtext = re.sub(r"^\s*(?:Question\b[:\s]*|Q\d*[:\s]*|\d+\s*[\.)\-:]\s*)", '', line, flags=re.IGNORECASE)
                ans_lines = []
                j = i + 1
                while j < len(lines):
                    l = lines[j].strip()
                    if not l:
                        j += 1
                        if j < len(lines) and question_re.search(lines[j]):
                            break
                        continue
                    if question_re.search(l):
                        break
                    if answer_marker_re.search(l):
                        a = answer_marker_re.sub('', l).strip()
                        if a:
                            ans_lines.append(a)
                        j += 1
                        while j < len(lines) and not question_re.search(lines[j]):
                            if lines[j].strip():
                                ans_lines.append(lines[j].strip())
                            j += 1
                        break
                    ans_lines.append(l)
                    j += 1
                answer = ' '.join(ans_lines).strip()
                qa.append({'question': qtext.strip() or line, 'answer': answer or None})
                i = j
                continue
            i += 1
        return qa

    qa_pairs = extract_qa_pairs_local(content)
    has_questions = bool(qa_pairs) or bool(re.search(r"\bQ(?:uestion)?\s*\d+\b|\bQ\d+\b|\bQuestion:\b|\bName:\b|\bStudent:\b|\bCandidate:\b|^\d+\.\s", content, flags=re.IGNORECASE | re.MULTILINE))

    return {
        'filename': file_data.get('filename'),
        'extension': file_data.get('extension'),
        'file_type': file_data.get('file_type'),
        'content': content,
        'qa_pairs': qa_pairs,
        'has_questions': has_questions
    }


@router.get("/verify-determinism")
async def verify_determinism(
    description: str = "Write a Python function to calculate factorial",
    question: str = "Define a recursive factorial function",
    student_answer: str = "def factorial(n): return 1 if n <= 1 else n * factorial(n-1)",
    num_runs: int = 3,
    current_user: User = Depends(get_current_user)
):
    """
    ADMIN DEBUG ENDPOINT: Test determinism by running same evaluation multiple times.
    Returns list of scores to verify consistency.
    
    Query Parameters:
    - description: Assignment description (default: factorial example)
    - question: Specific question (default: factorial function)
    - student_answer: Student's submitted answer (default: correct factorial code)
    - num_runs: Number of times to evaluate (default: 3)
    
    Returns: Dictionary with all evaluation results and variance analysis
    """
    if num_runs < 1 or num_runs > 10:
        raise HTTPException(status_code=400, detail="num_runs must be between 1 and 10")
    
    gemini_service = GeminiService()
    results = []
    
    try:
        for i in range(num_runs):
            result = await gemini_service.evaluate_one_qa(description, question, student_answer)
            
            if result["success"]:
                resp = result["response"]
                results.append({
                    "run": i + 1,
                    "is_correct": resp.is_correct,
                    "partial_credit": resp.partial_credit,
                    "score": 1.0 if resp.is_correct else (resp.partial_credit or 0.0),
                    "feedback": resp.feedback[:100] + "..." if len(resp.feedback) > 100 else resp.feedback
                })
            else:
                results.append({
                    "run": i + 1,
                    "error": result.get("error", {}).get("message", "Unknown error")
                })
        
        # Calculate variance
        scores = [r["score"] for r in results if "score" in r]
        
        if scores:
            variance = max(scores) - min(scores) if len(scores) > 1 else 0.0
            is_deterministic = variance <= DeterministicEvalConfig.ALLOWED_VARIANCE
            
            return {
                "status": "DETERMINISTIC ✓" if is_deterministic else "VARIANCE DETECTED ⚠",
                "configuration": {
                    "model": DeterministicEvalConfig.FIXED_MODEL,
                    "temperature": DeterministicEvalConfig.TEMPERATURE,
                    "consensus_enabled": DeterministicEvalConfig.USE_CONSENSUS,
                    "consensus_calls": DeterministicEvalConfig.CONSENSUS_CALLS,
                    "allowed_variance": DeterministicEvalConfig.ALLOWED_VARIANCE,
                    "cache_enabled": DeterministicEvalConfig.ENABLE_RESULT_CACHE
                },
                "results": results,
                "analysis": {
                    "total_runs": len(scores),
                    "scores": scores,
                    "min_score": min(scores),
                    "max_score": max(scores),
                    "variance": variance,
                    "is_deterministic": is_deterministic,
                    "message": f"All {len(scores)} runs produced consistent results!" if is_deterministic else f"Score variance of {variance} exceeds threshold of {DeterministicEvalConfig.ALLOWED_VARIANCE}"
                }
            }
        else:
            return {
                "status": "ERROR",
                "results": results,
                "message": "All evaluation runs failed"
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Determinism test failed: {str(e)}")


@router.get("/cache-stats")
def cache_stats(current_user: User = Depends(get_current_user)):
    """Get evaluation cache statistics"""
    stats = EvaluationCache.get_cache_stats()
    return {
        "cache_enabled": DeterministicEvalConfig.ENABLE_RESULT_CACHE,
        "cache_ttl_days": DeterministicEvalConfig.CACHE_TTL_DAYS,
        "statistics": stats
    }


@router.post("/cache-clear")
def cache_clear(current_user: User = Depends(get_current_user)):
    """Clear all cached evaluation results (ADMIN ONLY)"""
    count = EvaluationCache.clear_all()
    return {
        "status": "SUCCESS",
        "cleared_entries": count,
        "message": f"Cleared {count} cached evaluation results"
    }


@router.get("/determinism-config")
def get_determinism_config(current_user: User = Depends(get_current_user)):
    """Get current determinism configuration"""
    return {
        "FIXED_MODEL": DeterministicEvalConfig.FIXED_MODEL,
        "TEMPERATURE": DeterministicEvalConfig.TEMPERATURE,
        "SEED": DeterministicEvalConfig.SEED,
        "USE_CONSENSUS": DeterministicEvalConfig.USE_CONSENSUS,
        "CONSENSUS_CALLS": DeterministicEvalConfig.CONSENSUS_CALLS,
        "CONSENSUS_THRESHOLD": DeterministicEvalConfig.CONSENSUS_THRESHOLD,
        "VALIDATE_CONTENT_HASH": DeterministicEvalConfig.VALIDATE_CONTENT_HASH,
        "ENABLE_RESULT_CACHE": DeterministicEvalConfig.ENABLE_RESULT_CACHE,
        "CACHE_TTL_DAYS": DeterministicEvalConfig.CACHE_TTL_DAYS,
        "SCORE_PRECISION": DeterministicEvalConfig.SCORE_PRECISION,
        "ALLOWED_VARIANCE": DeterministicEvalConfig.ALLOWED_VARIANCE
    }
