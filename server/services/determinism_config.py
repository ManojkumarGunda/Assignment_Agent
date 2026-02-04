"""
Determinism Configuration & Evaluation Caching
Ensures reproducible, consistent evaluation results across multiple sessions
"""
import hashlib
import json
import logging
from pathlib import Path
from typing import Dict, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

EVALUATION_CACHE_DIR = Path("evaluation_cache")
EVALUATION_CACHE_DIR.mkdir(exist_ok=True)


class DeterministicEvalConfig:
    """Configuration for deterministic evaluation"""
    
    # CRITICAL: These must NEVER change once set in production
    FIXED_MODEL = "gemini-2.5-pro"
    TEMPERATURE = 0.0  # Must be 0 for deterministic output
    SEED = 42  # Fixed seed for consistency
    
    # Evaluation strategy
    USE_CONSENSUS = True  # 3-call majority voting
    CONSENSUS_CALLS = 3
    CONSENSUS_THRESHOLD = 0.67  # 2 out of 3 votes
    
    # Content validation
    VALIDATE_CONTENT_HASH = True
    ENABLE_RESULT_CACHE = True
    CACHE_TTL_DAYS = 365  # Cache results for 1 year (essentially permanent for university)
    
    # Scoring precision
    SCORE_PRECISION = 2  # Round to 2 decimal places
    ALLOWED_VARIANCE = 2.0  # Allow ±2% variance for edge cases
    
    @staticmethod
    def get_content_hash(content: str) -> str:
        """Generate deterministic hash of content"""
        if not isinstance(content, str):
            content = str(content)
        # Normalize: strip whitespace, lowercase for consistency
        normalized = content.strip()
        return hashlib.sha256(normalized.encode()).hexdigest()
    
    @staticmethod
    def validate_configuration() -> bool:
        """Validate config is compatible with determinism"""
        if DeterministicEvalConfig.TEMPERATURE != 0.0:
            logger.warning("⚠️  Temperature is not 0.0! Non-deterministic results expected.")
            return False
        
        if DeterministicEvalConfig.USE_CONSENSUS and DeterministicEvalConfig.CONSENSUS_CALLS < 2:
            logger.warning("⚠️  Consensus requires at least 2 calls")
            return False
        
        return True


class EvaluationCache:
    """Cache evaluation results based on content hash"""
    
    @staticmethod
    def _get_cache_file(content_hash: str, eval_type: str = "qa") -> Path:
        """Get cache file path for evaluation"""
        cache_subdir = EVALUATION_CACHE_DIR / eval_type
        cache_subdir.mkdir(exist_ok=True, parents=True)
        return cache_subdir / f"{content_hash}.json"
    
    @staticmethod
    def get(content_hash: str, eval_type: str = "qa") -> Optional[Dict]:
        """Retrieve cached evaluation result"""
        if not DeterministicEvalConfig.ENABLE_RESULT_CACHE:
            return None
        
        cache_file = EvaluationCache._get_cache_file(content_hash, eval_type)
        
        if not cache_file.exists():
            return None
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
            
            # Check TTL
            cached_at = datetime.fromisoformat(cached_data.get('cached_at', '1970-01-01'))
            age_days = (datetime.now() - cached_at).days
            
            if age_days > DeterministicEvalConfig.CACHE_TTL_DAYS:
                # logger.info(f"Cache expired for {content_hash[:8]}...")
                return None
            
            # logger.info(f"✓ Cache HIT for evaluation type '{eval_type}' (content_hash={content_hash[:8]}...)")
            return cached_data.get('result')
        
        except Exception as e:
            logger.error(f"Error reading cache: {e}")
            return None
    
    @staticmethod
    def set(content_hash: str, result: Dict, eval_type: str = "qa") -> bool:
        """Store evaluation result in cache"""
        if not DeterministicEvalConfig.ENABLE_RESULT_CACHE:
            return False
        
        try:
            cache_file = EvaluationCache._get_cache_file(content_hash, eval_type)
            
            cache_data = {
                'content_hash': content_hash,
                'eval_type': eval_type,
                'cached_at': datetime.now().isoformat(),
                'result': result
            }
            
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, indent=2, default=str)
            
            # logger.info(f"✓ Cache STORED for evaluation type '{eval_type}' (content_hash={content_hash[:8]}...)")
            return True
        
        except Exception as e:
            logger.error(f"Error writing cache: {e}")
            return False
    
    @staticmethod
    def clear_all() -> int:
        """Clear all cached evaluations (for admin/testing)"""
        count = 0
        try:
            for cache_file in EVALUATION_CACHE_DIR.rglob('*.json'):
                cache_file.unlink()
                count += 1
            logger.info(f"Cleared {count} cached evaluations")
            return count
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
            return count
    
    @staticmethod
    def get_cache_stats() -> Dict:
        """Get cache statistics"""
        count = 0
        total_size = 0
        
        try:
            for cache_file in EVALUATION_CACHE_DIR.rglob('*.json'):
                count += 1
                total_size += cache_file.stat().st_size
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
        
        return {
            'total_cached_results': count,
            'total_size_bytes': total_size,
            'cache_dir': str(EVALUATION_CACHE_DIR)
        }
