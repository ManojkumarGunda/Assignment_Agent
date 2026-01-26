from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from environment variable
raw_url = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:CoastalSeven%40B4@db.nfnvsguefvwoxpylibha.supabase.co:5432/postgres"
)

# Force SSL mode for Render/Supabase connection
if "sslmode" not in raw_url:
    if "?" in raw_url:
        DATABASE_URL = f"{raw_url}&sslmode=require"
    else:
        DATABASE_URL = f"{raw_url}?sslmode=require"
else:
    DATABASE_URL = raw_url

# 4. Create engine with production-ready settings
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
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

