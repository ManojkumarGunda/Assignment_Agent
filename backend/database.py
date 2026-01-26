from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from environment variable
# 1. Get the raw URL
raw_url = os.getenv("DATABASE_URL")

# HACK: User has difficulty updating Render Env Vars.
# We detect the OLD broken project ID and force the NEW one.
# Old ID: nfnvsguefvwoxpylibha
# New ID: khrlktqnfmfawbrtdufz
if raw_url and "nfnvsguefvwoxpylibha" in raw_url:
    print("⚠️ DETECTED STALE ENV VAR. Overriding with new credentials...", flush=True)
    # Trying Direct Connection to the new project
    raw_url = "postgresql://postgres:Manoj_gunda@db.khrlktqnfmfawbrtdufz.supabase.co:5432/postgres"

# 2. Fallback for local development if env var is missing
if not raw_url:
    raw_url = "postgresql://postgres:Manoj_gunda@db.khrlktqnfmfawbrtdufz.supabase.co:5432/postgres"

# 3. Bulletproof SSL injection for Supabase/Render
if "sslmode" not in raw_url:
    delimiter = "&" if "?" in raw_url else "?"
    DATABASE_URL = f"{raw_url}{delimiter}sslmode=require"
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

