from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Get database URL ONLY from environment
raw_url = os.getenv("DATABASE_URL")

if not raw_url:
    raise RuntimeError("DATABASE_URL is not set")

# Force SSL (required for Supabase)
if "sslmode" not in raw_url:
    if "?" in raw_url:
        DATABASE_URL = f"{raw_url}&sslmode=require"
    else:
        DATABASE_URL = f"{raw_url}?sslmode=require"
else:
    DATABASE_URL = raw_url

engine = create_engine(DATABASE_URL)

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
