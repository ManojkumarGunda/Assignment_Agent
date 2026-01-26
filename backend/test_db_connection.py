import os
import sys
from sqlalchemy import create_engine, text

# The exact URL causing issues
DB_URL = "postgresql://postgres:CoastalSeven%40B4@db.nfnvsguefvwoxpylibha.supabase.co:5432/postgres?sslmode=require"

print(f"Testing connection to: {DB_URL}", flush=True)

try:
    print("Attempting to connect...", flush=True)
    # create_engine is usually lazy, but we will force connection next
    engine = create_engine(DB_URL, connect_args={"connect_timeout": 10})
    
    with engine.connect() as conn:
        print("Connection acquired. Executing query...", flush=True)
        result = conn.execute(text("SELECT 1"))
        print("\n✅ SUCCESS! Database Connection Works.", flush=True)
except Exception as e:
    print("\n❌ FAILURE. Could not connect.", flush=True)
    print(f"Error Type: {type(e).__name__}", flush=True)
    print(f"Error: {e}", flush=True)
