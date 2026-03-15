from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import numpy as np
import json

from store import get_dataset

router = APIRouter()

class StatsRequest(BaseModel):
    sessionId: str
    columns: Optional[list[str]] = []

@router.post("/stats")
async def run_statistics(request: StatsRequest):
    """
    Computes comprehensive summary statistics
    for the dataset in a session.
    """
    try:
        df = get_dataset(request.sessionId)

        if df is None:
            raise HTTPException(
                status_code=404,
                detail="No dataset found for this session. Please upload a file first."
            )

        # Filter to requested columns if specified
        if request.columns:
            missing = [c for c in request.columns if c not in df.columns]
            if missing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Columns not found: {missing}"
                )
            df = df[request.columns]

        result = {}

        # --- Numeric column statistics ---
        numeric_df = df.select_dtypes(include=["number"])
        if not numeric_df.empty:
            result["numeric"] = compute_numeric_stats(numeric_df)

        # --- Categorical column statistics ---
        categorical_df = df.select_dtypes(include=["object", "category"])
        if not categorical_df.empty:
            result["categorical"] = compute_categorical_stats(categorical_df)

        # --- Correlation matrix ---
        if len(numeric_df.columns) > 1:
            result["correlations"] = compute_correlations(numeric_df)

        # --- Overall dataset stats ---
        result["overview"] = {
            "totalRows": len(df),
            "totalColumns": len(df.columns),
            "numericColumns": numeric_df.columns.tolist(),
            "categoricalColumns": categorical_df.columns.tolist(),
            "totalNulls": int(df.isnull().sum().sum()),
            "duplicateRows": int(df.duplicated().sum()),
        }

        return {"success": True, "data": result}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compute statistics: {str(e)}"
        )


def compute_numeric_stats(df: pd.DataFrame) -> dict:
    """
    Compute detailed statistics for numeric columns
    """
    # Columns that should be treated as currency
    currency_keywords = [
        "revenue", "profit", "cost", "price", "sales",
        "income", "salary", "amount", "total", "fee",
        "wage", "earning", "spend", "budget", "value"
    ]

    stats = {}
    for col in df.columns:
        series = df[col].dropna()
        if len(series) == 0:
            continue

        # Detect if column is likely currency
        is_currency = any(
            keyword in col.lower()
            for keyword in currency_keywords
        )

        stats[col] = {
            "count": int(series.count()),
            "mean": round(float(series.mean()), 2),
            "median": round(float(series.median()), 2),
            "std": round(float(series.std()), 2),
            "min": round(float(series.min()), 2),
            "max": round(float(series.max()), 2),
            "q25": round(float(series.quantile(0.25)), 2),
            "q75": round(float(series.quantile(0.75)), 2),
            "nullCount": int(df[col].isnull().sum()),
            "sum": round(float(series.sum()), 2),
            "isCurrency": is_currency,
            "format": "currency" if is_currency else "number"
        }
    return stats


def compute_categorical_stats(df: pd.DataFrame) -> dict:
    """
    Compute statistics for categorical columns:
    unique count, top values, frequency distribution
    """
    stats = {}
    for col in df.columns:
        series = df[col].dropna()
        if len(series) == 0:
            continue

        # Top 10 most frequent values
        value_counts = series.value_counts().head(10)

        stats[col] = {
            "count": int(series.count()),
            "uniqueCount": int(series.nunique()),
            "nullCount": int(df[col].isnull().sum()),
            "topValues": value_counts.index.tolist(),
            "topCounts": value_counts.values.tolist(),
            "mode": str(series.mode()[0]) if len(series.mode()) > 0 else None,
        }
    return stats


def compute_correlations(df: pd.DataFrame) -> dict:
    """
    Compute Pearson correlation matrix between
    all numeric columns. Returns only significant
    correlations (|r| > 0.3) to reduce noise.
    """
    corr_matrix = df.corr(numeric_only=True)

    # Convert to a list of significant correlations
    correlations = []
    cols = corr_matrix.columns.tolist()

    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            val = corr_matrix.iloc[i, j]
            if not np.isnan(val) and abs(val) > 0.3:
                correlations.append({
                    "column1": cols[i],
                    "column2": cols[j],
                    "correlation": round(float(val), 4),
                    "strength": get_correlation_strength(val),
                })

    # Sort by absolute correlation strength
    correlations.sort(key=lambda x: abs(x["correlation"]), reverse=True)

    return correlations


def get_correlation_strength(r: float) -> str:
    """Describe correlation strength in plain English"""
    abs_r = abs(r)
    direction = "positive" if r > 0 else "negative"

    if abs_r >= 0.8:
        return f"very strong {direction}"
    elif abs_r >= 0.6:
        return f"strong {direction}"
    elif abs_r >= 0.4:
        return f"moderate {direction}"
    else:
        return f"weak {direction}"