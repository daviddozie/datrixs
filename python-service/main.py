from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from routes.ingest import router as ingest_router
from routes.stats import router as stats_router
from routes.analyze import router as analyze_router
from routes.merge import router as merge_router
from routes.dataset_info import router as dataset_info_router

app = FastAPI(
    title="Datrixs Data Processing API",
    description="Handles data ingestion, statistics, and analysis for Datrixs",
    version="1.0.0"
)

# Allow requests from Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all route modules
app.include_router(ingest_router)
app.include_router(stats_router)
app.include_router(analyze_router)
app.include_router(merge_router)
app.include_router(dataset_info_router)

# Health check endpoint
# Used to verify the service is running
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Datrixs Python Service"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)