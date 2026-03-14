from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import numpy as np

from store import get_dataset

router = APIRouter()

class AnalyzeRequest(BaseModel):
    sessionId: str
    query: str

@router.post("/analyze")
async def analyze_data(request: AnalyzeRequest):
    """
    Runs analysis on the dataset based on a
    plain English query from the agent.
    Detects the type of analysis needed and
    runs the appropriate pandas operations.
    """
    try:
        df = get_dataset(request.sessionId)

        if df is None:
            raise HTTPException(
                status_code=404,
                detail="No dataset found for this session."
            )

        query = request.query.lower()
        result = {}

        # --- Detect and run appropriate analysis ---

        if any(word in query for word in ["group", "by", "per", "each"]):
            result = run_groupby_analysis(df, request.query)

        elif any(word in query for word in ["top", "highest", "largest", "most", "best"]):
            result = run_top_analysis(df, request.query)

        elif any(word in query for word in ["bottom", "lowest", "smallest", "least", "worst"]):
            result = run_bottom_analysis(df, request.query)

        elif any(word in query for word in ["trend", "over time", "by month", "by year", "by date"]):
            result = run_trend_analysis(df, request.query)

        elif any(word in query for word in ["filter", "where", "only", "show"]):
            result = run_filter_analysis(df, request.query)

        elif any(word in query for word in ["compare", "vs", "versus", "difference"]):
            result = run_comparison_analysis(df, request.query)

        elif any(word in query for word in ["count", "how many", "number of"]):
            result = run_count_analysis(df, request.query)

        elif any(word in query for word in ["sum", "total", "revenue", "sales"]):
            result = run_sum_analysis(df, request.query)

        else:
            # Default: return general overview
            result = run_general_analysis(df)

        return {"success": True, "data": result, "query": request.query}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze data: {str(e)}"
        )


def run_groupby_analysis(df: pd.DataFrame, query: str) -> dict:
    """Group data by categorical columns and aggregate"""
    categorical_cols = df.select_dtypes(
        include=["object", "category"]
    ).columns.tolist()

    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

    if not categorical_cols or not numeric_cols:
        return run_general_analysis(df)

    # Use first categorical column for grouping
    group_col = categorical_cols[0]
    results = {}

    for num_col in numeric_cols[:5]:  # Limit to 5 numeric columns
        grouped = df.groupby(group_col)[num_col].agg([
            "sum", "mean", "count", "min", "max"
        ]).round(4)
        results[f"{group_col}_by_{num_col}"] = grouped.reset_index().to_dict(
            orient="records"
        )

    return {
        "type": "groupby",
        "groupColumn": group_col,
        "results": results,
        "summary": f"Grouped {len(df)} rows by '{group_col}' with {df[group_col].nunique()} unique values"
    }


def run_top_analysis(df: pd.DataFrame, query: str) -> dict:
    """Return top N rows by numeric columns"""
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

    if not numeric_cols:
        return run_general_analysis(df)

    # Extract N from query (default 10)
    n = 10
    for word in query.split():
        if word.isdigit():
            n = int(word)
            break

    col = numeric_cols[0]
    top_rows = df.nlargest(n, col).fillna("").to_dict(orient="records")

    return {
        "type": "top",
        "column": col,
        "n": n,
        "results": top_rows,
        "summary": f"Top {n} rows by '{col}'"
    }


def run_bottom_analysis(df: pd.DataFrame, query: str) -> dict:
    """Return bottom N rows by numeric columns"""
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

    if not numeric_cols:
        return run_general_analysis(df)

    n = 10
    for word in query.split():
        if word.isdigit():
            n = int(word)
            break

    col = numeric_cols[0]
    bottom_rows = df.nsmallest(n, col).fillna("").to_dict(orient="records")

    return {
        "type": "bottom",
        "column": col,
        "n": n,
        "results": bottom_rows,
        "summary": f"Bottom {n} rows by '{col}'"
    }


def run_trend_analysis(df: pd.DataFrame, query: str) -> dict:
    """Analyze trends over time using date columns"""
    # Find date columns
    date_cols = []
    for col in df.columns:
        try:
            pd.to_datetime(df[col])
            date_cols.append(col)
        except Exception:
            continue

    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

    if not date_cols or not numeric_cols:
        return run_general_analysis(df)

    date_col = date_cols[0]
    num_col = numeric_cols[0]

    # Convert to datetime and group by month
    df_copy = df.copy()
    df_copy[date_col] = pd.to_datetime(df_copy[date_col])
    df_copy["period"] = df_copy[date_col].dt.to_period("M").astype(str)

    trend = df_copy.groupby("period")[num_col].agg([
        "sum", "mean", "count"
    ]).round(4).reset_index()

    return {
        "type": "trend",
        "dateColumn": date_col,
        "valueColumn": num_col,
        "results": trend.to_dict(orient="records"),
        "summary": f"Trend of '{num_col}' over time grouped by month"
    }


def run_filter_analysis(df: pd.DataFrame, query: str) -> dict:
    """Return filtered subset of data"""
    # Return a sample of the data with all columns
    sample = df.head(20).fillna("").to_dict(orient="records")

    return {
        "type": "filter",
        "results": sample,
        "totalRows": len(df),
        "summary": f"Showing first 20 of {len(df)} rows"
    }


def run_comparison_analysis(df: pd.DataFrame, query: str) -> dict:
    """Compare statistics across categorical groups"""
    categorical_cols = df.select_dtypes(
        include=["object", "category"]
    ).columns.tolist()

    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

    if not categorical_cols or not numeric_cols:
        return run_general_analysis(df)

    group_col = categorical_cols[0]
    comparisons = {}

    for num_col in numeric_cols[:3]:
        grouped = df.groupby(group_col)[num_col].agg([
            "mean", "sum", "count"
        ]).round(4)
        comparisons[num_col] = grouped.reset_index().to_dict(orient="records")

    return {
        "type": "comparison",
        "groupColumn": group_col,
        "results": comparisons,
        "summary": f"Comparing {len(df[group_col].unique())} groups in '{group_col}'"
    }


def run_count_analysis(df: pd.DataFrame, query: str) -> dict:
    """Count values in categorical columns"""
    categorical_cols = df.select_dtypes(
        include=["object", "category"]
    ).columns.tolist()

    if not categorical_cols:
        return {"type": "count", "totalRows": len(df), "results": {}}

    counts = {}
    for col in categorical_cols[:3]:
        value_counts = df[col].value_counts().head(20)
        counts[col] = {
            "values": value_counts.index.tolist(),
            "counts": value_counts.values.tolist(),
            "uniqueCount": int(df[col].nunique()),
        }

    return {
        "type": "count",
        "results": counts,
        "totalRows": len(df),
        "summary": f"Value counts for categorical columns"
    }


def run_sum_analysis(df: pd.DataFrame, query: str) -> dict:
    """Compute totals for numeric columns"""
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

    if not numeric_cols:
        return run_general_analysis(df)

    totals = {}
    for col in numeric_cols:
        totals[col] = {
            "sum": round(float(df[col].sum()), 4),
            "mean": round(float(df[col].mean()), 4),
            "count": int(df[col].count()),
        }

    return {
        "type": "sum",
        "results": totals,
        "summary": f"Totals and averages for {len(numeric_cols)} numeric columns"
    }


def run_general_analysis(df: pd.DataFrame) -> dict:
    """Default analysis — returns overview of the dataset"""
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    categorical_cols = df.select_dtypes(
        include=["object", "category"]
    ).columns.tolist()

    overview = {
        "totalRows": len(df),
        "totalColumns": len(df.columns),
        "columns": df.columns.tolist(),
        "preview": df.head(10).fillna("").to_dict(orient="records"),
    }

    if numeric_cols:
        overview["numericSummary"] = df[numeric_cols].describe().round(4).to_dict()

    if categorical_cols:
        overview["categoricalSummary"] = {
            col: {
                "uniqueCount": int(df[col].nunique()),
                "topValue": str(df[col].mode()[0]) if len(df[col].mode()) > 0 else None,
            }
            for col in categorical_cols[:5]
        }

    return {"type": "general", "results": overview}