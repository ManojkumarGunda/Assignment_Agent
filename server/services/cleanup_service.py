import os
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session
from models import Assignment, AssignmentFile

logger = logging.getLogger(__name__)

class CleanupService:
    @staticmethod
    def run_cleanup(db: Session, days: int = 15):
        """
        Delete assignments and associated files older than 'days' days.
        """
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            logger.info(f"Starting database and file cleanup. Cutoff: {cutoff_date}")

            # 1. Find assignments older than the cutoff
            old_assignments = db.query(Assignment).filter(Assignment.created_at < cutoff_date).all()
            
            if not old_assignments:
                logger.info("No old assignments found for cleanup.")
                return

            logger.info(f"Found {len(old_assignments)} assignments to clean up.")

            for assignment in old_assignments:
                # 2. Delete physical files associated with the assignment
                for file_rec in assignment.files:
                    if file_rec.file_path:
                        try:
                            file_path = Path(file_rec.file_path)
                            if file_path.exists():
                                file_path.unlink()
                                logger.debug(f"Deleted physical file: {file_path}")
                                
                            # Also delete meta file if it exists
                            meta_path = file_path.with_name(f"{file_rec.file_id}.meta.json")
                            if meta_path.exists():
                                meta_path.unlink()
                        except Exception as fe:
                            logger.error(f"Error deleting file {file_rec.file_path}: {fe}")

                # 3. Delete the assignment record (cascades to files, results, and details)
                logger.debug(f"Deleting assignment record: {assignment.id}")
                db.delete(assignment)

            db.commit()
            logger.info(f"Successfully cleaned up {len(old_assignments)} assignments and their files.")

            # 4. Cleanup orphaned files in uploads/ folder older than 'days'
            CleanupService._cleanup_orphaned_files(days)

        except Exception as e:
            db.rollback()
            logger.error(f"Error during cleanup: {e}", exc_info=True)

    @staticmethod
    def _cleanup_orphaned_files(days: int):
        """Clean up any files in uploads/ that are older than 'days' but not in DB."""
        try:
            upload_dir = Path("uploads")
            if not upload_dir.exists():
                return

            cutoff_seconds = time.time() - (days * 24 * 3600)
            count = 0
            
            for item in upload_dir.iterdir():
                if item.is_file():
                    if item.stat().st_mtime < cutoff_seconds:
                        try:
                            item.unlink()
                            count += 1
                        except Exception:
                            pass
            
            if count > 0:
                logger.info(f"Cleaned up {count} orphaned temporary files.")
        except Exception as e:
            logger.error(f"Error cleaning orphaned files: {e}")
