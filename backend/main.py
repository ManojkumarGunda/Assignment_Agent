from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, files, github, reevaluate, debug, system, history
import os
from dotenv import load_dotenv

load_dotenv()

# Configure logging
import logging
logging.basicConfig(level=(os.getenv('APP_LOG_LEVEL','INFO')))
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(title="Evaluation API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(files.router)
app.include_router(github.router)
app.include_router(reevaluate.router)
app.include_router(debug.router)
app.include_router(system.router)
app.include_router(history.router)

# Automatic Cleanup Logic (15 Days)
import asyncio
from services.cleanup_service import CleanupService
from database import SessionLocal

async def scheduled_cleanup():
    """Background task to run cleanup daily"""
    while True:
        try:
            logger.info("Triggering scheduled cleanup task...")
            with SessionLocal() as db:
                CleanupService.run_cleanup(db, days=15)
        except Exception as e:
            logger.error(f"Error in scheduled cleanup background task: {e}")
        
        # Run once every 24 hours (86400 seconds)
        await asyncio.sleep(86400)

@app.on_event("startup")
async def startup_event():
    # Start the cleanup task in the background
    asyncio.create_task(scheduled_cleanup())


@app.get("/")
def read_root():
    return {"message": "Welcome to Evaluation API"}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "Evaluation API is running",
        "endpoints": {
            "auth": "/auth",
            "files": "/files", 
            "debug": "/debug"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
