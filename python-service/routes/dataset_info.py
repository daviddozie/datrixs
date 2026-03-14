from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os

from store import get_dataset, set_dataset, has_dataset

router = APIRouter()

class DatasetInfoResponse(BaseModel):
    sessionId: str
    columns: list[str]
    rowCount: int
    columnCount: int
    dtypes: dict
    preview: list[dict]
    nullCounts: dict
    numericColumns: list[str]
    categoricalColumns: list[str]

@router.get("/dataset-info/{session_id}")
async def get_dataset_info(session_id: str):
    """
    Returns metadata about the dataset for a session.
    The agent calls this first to understand what
    data it is working with before answering questions.
    """
    try:
        # Try to load from memory first
        df = get_dataset(session_id)

        # If not in memory, try loading from files
        if df is None:
            df = load_session_files(session_id)
            if df is not None:
                set_dataset(session_id, df)

        if df is None:
            return {
                "sessionId": session_id,
                "columns": [],
                "rowCount": 0,
                "columnCount": 0,
                "dtypes": {},
                "preview": [],
                "nullCounts": {},
                "numericColumns": [],
                "categoricalColumns": [],
                "message": "No data uploaded yet for this session"
            }

        # Get column data types
        dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}

        # Count null values per column
        null_counts = df.isnull().sum().to_dict()
        null_counts = {k: int(v) for k, v in null_counts.items()}

        # Identify numeric vs categorical columns
        numeric_cols = df.select_dtypes(
            include=["number"]
        ).columns.tolist()

        categorical_cols = df.select_dtypes(
            include=["object", "category"]
        ).columns.tolist()

        # Preview first 5 rows
        preview = df.head(5).fillna("").to_dict(orient="records")

        return {
            "sessionId": session_id,
            "columns": df.columns.tolist(),
            "rowCount": len(df),
            "columnCount": len(df.columns),
            "dtypes": dtypes,
            "preview": preview,
            "nullCounts": null_counts,
            "numericColumns": numeric_cols,
            "categoricalColumns": categorical_cols,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get dataset info: {str(e)}"
        )


def load_session_files(session_id: str):
    """
    Attempts to load files from disk for a session
    if they are not already in memory.
    Looks in the uploads/sessionId directory.
    """
    try:
        # Path to session uploads directory
        # Goes up one level from python-service to project root
        uploads_dir = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "uploads", session_id
        )

        if not os.path.exists(uploads_dir):
            return None

        from routes.ingest import load_file, clean_dataframe
        import pandas as pd

        dfs = []
        for filename in os.listdir(uploads_dir):
            file_path = os.path.join(uploads_dir, filename)
            ext = filename.split(".")[-1].lower()

            # Map extension to file type
            type_map = {
                "csv": "csv",
                "xlsx": "xlsx",
                "xls": "xlsx",
                "pdf": "pdf",
                "png": "image",
                "jpg": "image",
                "jpeg": "image",
                "webp": "image",
            }

            file_type = type_map.get(ext)
            if not file_type:
                continue

            try:
                df = load_file(file_path, file_type)
                df = clean_dataframe(df)
                dfs.append(df)
            except Exception:
                continue

        if not dfs:
            return None

        # If multiple files, concatenate them
        if len(dfs) == 1:
            return dfs[0]

        return pd.concat(dfs, ignore_index=True)

    except Exception:
        return None