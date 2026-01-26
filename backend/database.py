from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
import os
from dotenv import load_dotenv

load_dotenv()

# Get database URL ONLY from environment
# (Render will provide the correct one)
raw_url = os.getenv("DATABASE_URL")

if not raw_url:
    # Fallback for local testing if needed, or raise error
    raise RuntimeError("DATABASE_URL is not set")

# Force SSL (required for Supabase)
if "sslmode" not in raw_url:
    if "?" in raw_url:
        DATABASE_URL = f"{raw_url}&sslmode=require"
    else:
        DATABASE_URL = f"{raw_url}?sslmode=require"
else:
    DATABASE_URL = raw_url

# Create engine with NullPool
# This is REQUIRED for Supabase Transaction Pooler (pgbouncer) on port 6543
# It prevents SQLAlchemy from holding idle connections that confuse the pooler.
# forcing custom plan prevents "prepared statement" errors.
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool, 
    connect_args={
        "options": "-c plan_cache_mode=force_custom_plan"
    }
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
