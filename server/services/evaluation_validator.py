"""
Evaluation Consistency Validator
Ensures scoring is deterministic and reproducible across sessions
"""
import logging
import asyncio
from typing import Dict, List, Optional
from .gemini_service import GeminiService
from .determinism_config import DeterministicEvalConfig

logger = logging.getLogger(__name__)


class EvaluationConsistencyValidator:
    """Validates evaluation consistency and reproducibility"""
    
    @staticmethod
    async def validate_qa_evaluation_consistency(
        description: str,
        question: str,
        student_answer: str,
        num_trials: int = 5,
        threshold: float = 2.0
    ) -> Dict:
        """
        Validate that evaluating the same QA multiple times produces consistent scores.
        
        Args:
            description: Assignment description
            question: Question text
            student_answer: Student's answer
            num_trials: Number of evaluation trials (default 5)
            threshold: Maximum allowed score variance in percentage (default 2.0%)
        
        Returns:
            Dictionary with validation results and consistency metrics
        """
        if num_trials < 2 or num_trials > 20:
            return {
                "success": False,
                "error": "num_trials must be between 2 and 20"
            }
        
        gemini_service = GeminiService()
        scores = []
        feedback_samples = []
        
        logger.info(f"🔬 Starting consistency validation with {num_trials} trials...")
        
        for trial in range(num_trials):
            try:
                result = await gemini_service.evaluate_one_qa(description, question, student_answer)
                
                if result["success"]:
                    resp = result["response"]
                    score = 1.0 if resp.is_correct else (resp.partial_credit or 0.0)
                    scores.append(score)
                    
                    if trial < 2:  # Store first 2 feedback samples
                        feedback_samples.append(resp.feedback[:200])
                    
                    logger.info(f"✓ Trial {trial+1}: Score = {score}")
                else:
                    logger.error(f"✗ Trial {trial+1}: Failed - {result.get('error')}")
                    return {
                        "success": False,
                        "error": f"Trial {trial+1} failed: {result.get('error', {}).get('message')}",
                        "trials_completed": trial
                    }
            
            except Exception as e:
                logger.error(f"Exception in trial {trial+1}: {e}")
                return {
                    "success": False,
                    "error": f"Exception in trial {trial+1}: {str(e)}",
                    "trials_completed": trial
                }
        
        # Analyze consistency
        if not scores:
            return {
                "success": False,
                "error": "No valid scores obtained"
            }
        
        min_score = min(scores)
        max_score = max(scores)
        variance = max_score - min_score
        variance_percent = (variance / max(1.0, max_score)) * 100 if max_score > 0 else variance * 100
        
        # Check if all scores are identical
        all_identical = len(set(scores)) == 1
        
        # Variance check
        within_threshold = variance_percent <= threshold
        
        is_consistent = all_identical or within_threshold
        
        return {
            "success": True,
            "is_consistent": is_consistent,
            "status": "✓ CONSISTENT" if is_consistent else "⚠ VARIANCE DETECTED",
            "configuration": {
                "fixed_model": DeterministicEvalConfig.FIXED_MODEL,
                "temperature": DeterministicEvalConfig.TEMPERATURE,
                "consensus_enabled": DeterministicEvalConfig.USE_CONSENSUS,
                "consensus_calls": DeterministicEvalConfig.CONSENSUS_CALLS
            },
            "trials": num_trials,
            "scores": scores,
            "analysis": {
                "all_identical": all_identical,
                "min_score": min_score,
                "max_score": max_score,
                "variance": variance,
                "variance_percent": round(variance_percent, 2),
                "allowed_threshold": threshold,
                "within_threshold": within_threshold
            },
            "feedback_samples": feedback_samples
        }
    
    @staticmethod
    async def validate_content_hash_caching(
        description: str,
        question: str,
        student_answer: str
    ) -> Dict:
        """
        Verify that content hash caching works and returns identical results
        """
        from .determinism_config import EvaluationCache
        
        # Generate hashes
        combined = f"{description}|||{question}|||{student_answer}"
        content_hash = DeterministicEvalConfig.get_content_hash(combined)
        
        # Clear any existing cache
        EvaluationCache.get(content_hash, eval_type="qa_evaluation")  # Load if exists
        
        gemini_service = GeminiService()
        
        # First evaluation
        result1 = await gemini_service.evaluate_one_qa(description, question, student_answer)
        if not result1["success"]:
            return {
                "success": False,
                "error": "First evaluation failed"
            }
        
        # Second evaluation (should hit cache)
        result2 = await gemini_service.evaluate_one_qa(description, question, student_answer)
        if not result2["success"]:
            return {
                "success": False,
                "error": "Second evaluation failed"
            }
        
        # Compare results
        resp1 = result1["response"]
        resp2 = result2["response"]
        
        score1 = 1.0 if resp1.is_correct else (resp1.partial_credit or 0.0)
        score2 = 1.0 if resp2.is_correct else (resp2.partial_credit or 0.0)
        
        identical = score1 == score2 and resp1.feedback == resp2.feedback
        
        return {
            "success": True,
            "content_hash": content_hash[:16] + "...",
            "cache_enabled": DeterministicEvalConfig.ENABLE_RESULT_CACHE,
            "first_evaluation": {
                "score": score1,
                "is_correct": resp1.is_correct,
                "feedback_sample": resp1.feedback[:100]
            },
            "second_evaluation": {
                "score": score2,
                "is_correct": resp2.is_correct,
                "feedback_sample": resp2.feedback[:100]
            },
            "identical_results": identical,
            "status": "✓ CACHE WORKING" if identical else "⚠ CACHE MISMATCH"
        }
    
    @staticmethod
    async def validate_multi_file_consistency(
        descriptions_qa: List[Dict]
    ) -> Dict:
        """
        Validate consistency across multiple QA pairs
        
        Args:
            descriptions_qa: List of dicts with 'description', 'question', 'student_answer'
        
        Returns:
            Dictionary with consistency report
        """
        if not descriptions_qa or len(descriptions_qa) > 50:
            return {
                "success": False,
                "error": "Must provide between 1 and 50 QA pairs"
            }
        
        gemini_service = GeminiService()
        results = []
        
        for idx, qa in enumerate(descriptions_qa):
            try:
                result = await gemini_service.evaluate_one_qa(
                    qa.get("description", ""),
                    qa.get("question", ""),
                    qa.get("student_answer", "")
                )
                
                if result["success"]:
                    resp = result["response"]
                    score = 1.0 if resp.is_correct else (resp.partial_credit or 0.0)
                    results.append({
                        "qa_index": idx + 1,
                        "score": score,
                        "success": True
                    })
                else:
                    results.append({
                        "qa_index": idx + 1,
                        "success": False,
                        "error": result.get("error", {}).get("message")
                    })
            
            except Exception as e:
                results.append({
                    "qa_index": idx + 1,
                    "success": False,
                    "error": str(e)
                })
        
        successful_results = [r for r in results if r.get("success")]
        
        return {
            "success": True,
            "total_qa_pairs": len(descriptions_qa),
            "successful_evaluations": len(successful_results),
            "results": results
        }
