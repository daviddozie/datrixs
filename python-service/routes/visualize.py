from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import numpy as np

from store import get_dataset

router = APIRouter()

class VisualizeRequest(BaseModel):
    sessionId: str
    query: str
    chartType: Optional[str] = "auto"

@router.post("/visualize")
async def generate_visualization(request: VisualizeRequest):
    """
    Generates structured chart data based on the query.
    The frontend renders this as SVG charts in the chat.
    """
    try:
        df = get_dataset(request.sessionId)

        if df is None:
            raise HTTPException(
                status_code=404,
                detail="No dataset found for this session"
            )

        query = request.query.lower()

        # Auto-detect chart type from query
        chart_type = request.chartType
        if chart_type == "auto":
            if any(w in query for w in ["trend", "over time", "monthly", "yearly", "by date", "by month"]):
                chart_type = "line"
            elif any(w in query for w in ["distribution", "percentage", "proportion", "share", "breakdown"]):
                chart_type = "pie"
            elif any(w in query for w in ["compare", "by region", "by product", "by category", "ranking", "top", "highest", "lowest"]):
                chart_type = "bar"
            else:
                chart_type = "bar"

        # Generate chart data based on type
        if chart_type == "line":
            chart_data = generate_line_chart(df, query)
        elif chart_type == "pie":
            chart_data = generate_pie_chart(df, query)
        elif chart_type == "bar":
            chart_data = generate_bar_chart(df, query)
        else:
            chart_data = generate_bar_chart(df, query)

        return {
            "success": True,
            "chartType": chart_type,
            "data": chart_data,
            "query": request.query
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate visualization: {str(e)}"
        )


def generate_bar_chart(df: pd.DataFrame, query: str) -> dict:
    """Generate bar chart data — comparisons and rankings"""
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    categorical_cols = df.select_dtypes(
        include=["object", "category"]
    ).columns.tolist()

    if not numeric_cols or not categorical_cols:
        return generate_table(df)

    # Find best categorical column for grouping
    group_col = categorical_cols[0]
    for col in categorical_cols:
        col_lower = col.lower()
        if any(w in query for w in [col_lower, col_lower.replace("_", " ")]):
            group_col = col
            break

    # Find best numeric column
    value_col = numeric_cols[0]
    for col in numeric_cols:
        col_lower = col.lower().replace("_", " ")
        if col_lower in query or col.lower() in query:
            value_col = col
            break

    # Group and aggregate
    grouped = df.groupby(group_col)[value_col].sum().reset_index()
    grouped = grouped.sort_values(value_col, ascending=False).head(10)

    # Detect if currency
    currency_keywords = ["revenue", "profit", "cost", "price", "sales", "income", "salary", "amount"]
    is_currency = any(kw in value_col.lower() for kw in currency_keywords)

    return {
        "labels": grouped[group_col].tolist(),
        "values": [round(float(v), 2) for v in grouped[value_col].tolist()],
        "xLabel": group_col,
        "yLabel": value_col,
        "isCurrency": is_currency,
        "title": f"{value_col.replace('_', ' ').title()} by {group_col.replace('_', ' ').title()}"
    }


def generate_line_chart(df: pd.DataFrame, query: str) -> dict:
    """Generate line chart data — trends over time"""
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

    # Find date column
    date_col = None
    for col in df.columns:
        try:
            pd.to_datetime(df[col])
            date_col = col
            break
        except Exception:
            continue

    if not date_col or not numeric_cols:
        return generate_bar_chart(df, query)

    # Find best numeric column
    value_col = numeric_cols[0]
    for col in numeric_cols:
        if col.lower().replace("_", " ") in query or col.lower() in query:
            value_col = col
            break

    # Group by month
    df_copy = df.copy()
    df_copy[date_col] = pd.to_datetime(df_copy[date_col])
    df_copy["period"] = df_copy[date_col].dt.to_period("M").astype(str)
    grouped = df_copy.groupby("period")[value_col].sum().reset_index()
    grouped = grouped.sort_values("period")

    is_currency = any(kw in value_col.lower() for kw in ["revenue", "profit", "cost", "price", "sales"])

    return {
        "labels": grouped["period"].tolist(),
        "values": [round(float(v), 2) for v in grouped[value_col].tolist()],
        "xLabel": "Period",
        "yLabel": value_col,
        "isCurrency": is_currency,
        "title": f"{value_col.replace('_', ' ').title()} Trend Over Time"
    }


def generate_pie_chart(df: pd.DataFrame, query: str) -> dict:
    """Generate pie chart data — distributions"""
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    categorical_cols = df.select_dtypes(
        include=["object", "category"]
    ).columns.tolist()

    if not categorical_cols or not numeric_cols:
        return generate_bar_chart(df, query)

    group_col = categorical_cols[0]
    value_col = numeric_cols[0]

    for col in categorical_cols:
        if col.lower().replace("_", " ") in query:
            group_col = col
            break

    for col in numeric_cols:
        if col.lower().replace("_", " ") in query or col.lower() in query:
            value_col = col
            break

    grouped = df.groupby(group_col)[value_col].sum().reset_index()
    grouped = grouped.sort_values(value_col, ascending=False).head(8)
    total = grouped[value_col].sum()
    grouped["percentage"] = (grouped[value_col] / total * 100).round(1)

    return {
        "labels": grouped[group_col].tolist(),
        "values": [round(float(v), 2) for v in grouped[value_col].tolist()],
        "percentages": grouped["percentage"].tolist(),
        "xLabel": group_col,
        "yLabel": value_col,
        "isCurrency": any(kw in value_col.lower() for kw in ["revenue", "profit", "cost"]),
        "title": f"{value_col.replace('_', ' ').title()} Distribution by {group_col.replace('_', ' ').title()}"
    }


def generate_table(df: pd.DataFrame) -> dict:
    """Fallback — return data as a table"""
    return {
        "labels": df.columns.tolist(),
        "values": df.head(10).fillna("").to_dict(orient="records"),
        "title": "Data Preview",
        "isTable": True
    }