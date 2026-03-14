from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import os

from store import get_dataset, set_dataset

router = APIRouter()

class MergeRequest(BaseModel):
    sessionId: str

@router.post("/merge")
async def merge_datasets(request: MergeRequest):
    """
    Finds all files uploaded for a session,
    loads them, and merges them into one
    unified DataFrame stored under the sessionId.
    """
    try:
        uploads_dir = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "uploads", request.sessionId
        )

        if not os.path.exists(uploads_dir):
            raise HTTPException(
                status_code=404,
                detail="No uploads found for this session"
            )

        from routes.ingest import load_file, clean_dataframe

        # Load all files in the session's upload directory
        dfs = []
        loaded_files = []

        for filename in os.listdir(uploads_dir):
            file_path = os.path.join(uploads_dir, filename)
            ext = filename.split(".")[-1].lower()

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
                # Tag each row with its source file
                df["_source_file"] = filename
                dfs.append(df)
                loaded_files.append(filename)
            except Exception as e:
                continue

        if not dfs:
            raise HTTPException(
                status_code=400,
                detail="No valid datasets found to merge"
            )

        if len(dfs) == 1:
            merged_df = dfs[0]
            merge_strategy = "single"
        else:
            merged_df, merge_strategy = smart_merge(dfs)

        # Store merged dataset under sessionId
        # so the agent can query it directly
        set_dataset(request.sessionId, merged_df)

        preview = merged_df.head(5).fillna("").to_dict(orient="records")

        return {
            "success": True,
            "sessionId": request.sessionId,
            "filesLoaded": loaded_files,
            "mergeStrategy": merge_strategy,
            "rowCount": len(merged_df),
            "columnCount": len(merged_df.columns),
            "columns": merged_df.columns.tolist(),
            "preview": preview,
            "summary": f"Merged {len(dfs)} files into {len(merged_df)} rows and {len(merged_df.columns)} columns"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to merge datasets: {str(e)}"
        )


def smart_merge(dfs: list[pd.DataFrame]) -> tuple[pd.DataFrame, str]:
    """
    Intelligently merges multiple DataFrames.
    Strategy 1 — Join: if DataFrames share common columns,
    merge them on those columns.
    Strategy 2 — Concat: if DataFrames have same columns,
    stack them vertically.
    Strategy 3 — Side by side: if completely different
    columns, place them side by side.
    """
    if not dfs:
        raise ValueError("No DataFrames to merge")

    # Check if all DataFrames have identical columns
    all_columns = [set(df.columns.tolist()) for df in dfs]
    first_cols = all_columns[0]

    # Strategy 2: Same columns — stack vertically
    if all(cols == first_cols for cols in all_columns):
        merged = pd.concat(dfs, ignore_index=True)
        return merged, "vertical_concat"

    # Strategy 1: Find common columns for joining
    common_cols = first_cols
    for cols in all_columns[1:]:
        common_cols = common_cols.intersection(cols)

    # Remove _source_file from common cols
    common_cols = common_cols - {"_source_file"}

    if common_cols:
        # Merge on common columns
        merged = dfs[0]
        for df in dfs[1:]:
            merged = pd.merge(
                merged, df,
                on=list(common_cols),
                how="outer"
            )
        return merged, f"join_on_{list(common_cols)}"

    # Strategy 3: No common columns — concat side by side
    merged = pd.concat(dfs, axis=1)
    return merged, "horizontal_concat"