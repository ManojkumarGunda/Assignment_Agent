from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import User
from auth import get_current_user
from services.file_processor import FileProcessor
import re
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
