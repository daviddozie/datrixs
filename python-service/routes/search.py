from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import pandas as pd

from store import get_dataset
from embeddings import search_similar, index_dataset

router = APIRouter()

class SearchRequest(BaseModel):
    sessionId: str
    query: str
    topK: Optional[int] = 10

class IndexRequest(BaseModel):
    sessionId: str

@router.post("/search")
async def semantic_search(request: SearchRequest):
    """
    Performs semantic search over the session's dataset.
    Returns the most relevant rows for the query.
    Called by the Mastra agent's router tool to get
    relevant context before answering questions.
    """
    try:
        # Search LanceDB for relevant rows
        results = search_similar(
            session_id=request.sessionId,
            query=request.query,
            top_k=request.topK
        )

        if not results:
            # Fallback: if no embeddings, return dataset preview
            df = get_dataset(request.sessionId)
            if df is not None:
                preview = df.head(10).fillna("").to_dict(orient="records")
                return {
                    "success": True,
                    "results": preview,
                    "count": len(preview),
                    "method": "fallback_preview",
                    "message": "No embeddings found, returning preview"
                }
            return {
                "success": False,
                "results": [],
                "count": 0,
                "method": "none",
                "message": "No data found for this session"
            }

        return {
            "success": True,
            "results": results,
            "count": len(results),
            "method": "semantic_search",
            "message": f"Found {len(results)} relevant rows"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


@router.post("/index")
async def index_session(request: IndexRequest):
    """
    Manually trigger indexing of a session's dataset.
    Called after file upload to build the vector index.
    """
    try:
        df = get_dataset(request.sessionId)

        if df is None:
            raise HTTPException(
                status_code=404,
                detail="No dataset found for this session"
            )

        count = index_dataset(request.sessionId, df)

        return {
            "success": True,
            "sessionId": request.sessionId,
            "rowsIndexed": count,
            "message": f"Successfully indexed {count} rows"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Indexing failed: {str(e)}"
        )