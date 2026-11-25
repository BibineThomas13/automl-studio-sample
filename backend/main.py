import io
import os
import time
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client, create_client

# 1. Load environment variables from backend/.env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY in backend/.env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="AutoML Studio - CSV Profiler API")

# 2. Allow your React Vite dev server (port 5173) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "AutoML Studio Backend"}


@app.post("/api/profile")
async def profile_csv(file: UploadFile = File(...)):
    # Validate file extension
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    # Read raw bytes and parse with Pandas
    raw_bytes = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {exc}")

    row_count, col_count = df.shape
    toxic_columns = []
    column_profiles = []

    # Profile each column and flag toxic columns
    for col in df.columns:
        null_count = int(df[col].isna().sum())
        unique_count = int(df[col].nunique(dropna=True))
        dtype_str = str(df[col].dtype)

        reason = None
        if row_count > 0 and unique_count == row_count:
            reason = "100% unique identifier"
        elif unique_count <= 1:
            reason = "zero-variance column"

        if reason:
            toxic_columns.append({"column": col, "reason": reason})

        column_profiles.append({
            "name": col,
            "dtype": dtype_str,
            "null_count": null_count,
            "unique_count": unique_count,
            "is_toxic": reason is not None,
        })

    # Upload raw CSV file to Supabase Storage ('raw_csvs' bucket)
    storage_path = f"{int(time.time())}_{file.filename}"
    supabase.storage.from_("raw_csvs").upload(
        path=storage_path,
        file=raw_bytes,
        file_options={"content-type": "text/csv"},
    )
    raw_url = supabase.storage.from_("raw_csvs").get_public_url(storage_path)

    # Insert dataset metadata into PostgreSQL ('datasets' table)
    insert_res = (
        supabase.table("datasets")
        .insert({
            "filename": file.filename,
            "row_count": row_count,
            "col_count": col_count,
            "raw_storage_url": raw_url,
            "toxic_columns": toxic_columns,
        })
        .execute()
    )

    dataset_record = insert_res.data[0] if insert_res.data else {}

    return {
        "dataset_id": dataset_record.get("id"),
        "filename": file.filename,
        "row_count": row_count,
        "col_count": col_count,
        "toxic_columns": toxic_columns,
        "columns": column_profiles,
        "preview": df.head(5).fillna("NULL").to_dict(orient="records"),
        "raw_storage_url": raw_url,
    }