from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import pdfplumber
import pytesseract
from PIL import Image
import json
import os

from store import set_dataset, get_dataset
from embeddings import index_dataset

router = APIRouter()

class IngestRequest(BaseModel):
    fileId: str
    sessionId: str
    filePath: str
    fileType: str

class IngestResponse(BaseModel):
    success: bool
    fileId: str
    rowCount: int
    columnCount: int
    columns: list[str]
    preview: list[dict]

@router.post("/ingest", response_model=IngestResponse)
async def ingest_file(request: IngestRequest):
    """
    Receives a file path from Next.js after upload,
    reads it into a pandas DataFrame, stores it,
    and returns metadata about the dataset.
    """
    try:
        # Check file exists
        if not os.path.exists(request.filePath):
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {request.filePath}"
            )

        # Load file based on type
        df = load_file(request.filePath, request.fileType)

        if df is None or df.empty:
            raise HTTPException(
                status_code=400,
                detail="Could not extract data from file"
            )

        # Clean the dataframe
        df = clean_dataframe(df)

        # Store under fileId for individual file access
        set_dataset(request.fileId, df)

        # Store under sessionId for agent queries
        # If session already has data, append to avoid losing
        # previously uploaded files in the same session
        existing = get_dataset(request.sessionId)
        if existing is not None:
            combined = pd.concat([existing, df], ignore_index=True)
            combined = combined.drop_duplicates()
            set_dataset(request.sessionId, combined)
        else:
            set_dataset(request.sessionId, df)
        try:
            final_df = get_dataset(request.sessionId)
            if final_df is not None:
                index_dataset(request.sessionId, final_df)
        except Exception as e:
            # Don't fail upload if indexing fails
            print(f"Warning: RAG indexing failed: {e}")

        # Return metadata about the dataset
        preview = df.head(5).fillna("").to_dict(orient="records")

        return IngestResponse(
            success=True,
            fileId=request.fileId,
            rowCount=len(df),
            columnCount=len(df.columns),
            columns=df.columns.tolist(),
            preview=preview
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ingest file: {str(e)}"
        )

def load_file(file_path: str, file_type: str) -> pd.DataFrame:
    """
    Load a file into a pandas DataFrame
    based on its type
    """
    if file_type == "csv":
        return load_csv(file_path)
    elif file_type == "xlsx":
        return load_xlsx(file_path)
    elif file_type == "pdf":
        return load_pdf(file_path)
    elif file_type == "image":
        return load_image(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def load_csv(file_path: str) -> pd.DataFrame:
    """Load CSV file — try common encodings"""
    encodings = ["utf-8", "latin-1", "iso-8859-1"]
    for encoding in encodings:
        try:
            return pd.read_csv(file_path, encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("Could not decode CSV file")


def load_xlsx(file_path: str) -> pd.DataFrame:
    """Load Excel file — reads the first sheet"""
    return pd.read_excel(file_path, engine="openpyxl")


def load_pdf(file_path: str) -> pd.DataFrame:
    """
    Extract ALL tables from PDF using pdfplumber.
    Combines all tables found across all pages
    into one unified DataFrame.
    """
    all_tables = []

    with pdfplumber.open(file_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            for table_idx, table in enumerate(tables):
                if not table or len(table) < 2:
                    continue

                # First row is headers
                headers = table[0]

                # Clean headers — remove None and empty strings
                headers = [
                    str(h).strip() if h else f"Column_{i}"
                    for i, h in enumerate(headers)
                ]

                rows = table[1:]

                # Skip empty tables
                if not rows:
                    continue

                # Ensure all rows match header length
                clean_rows = []
                for row in rows:
                    if len(row) < len(headers):
                        # Pad short rows with None
                        row = row + [None] * (len(headers) - len(row))
                    elif len(row) > len(headers):
                        # Trim long rows
                        row = row[:len(headers)]
                    clean_rows.append(row)

                if not clean_rows:
                    continue

                df = pd.DataFrame(clean_rows, columns=headers)

                # Add metadata columns so agent knows
                # which page and table this came from
                df["_page"] = page_num + 1
                df["_table_index"] = table_idx + 1

                all_tables.append(df)

    if not all_tables:
        # Fallback: try extracting text if no tables found
        return extract_text_as_table(file_path)

    # If only one table found, return it directly
    if len(all_tables) == 1:
        return all_tables[0]

    # Multiple tables — try to combine intelligently
    return combine_pdf_tables(all_tables)


def extract_text_as_table(file_path: str) -> pd.DataFrame:
    """
    Fallback for PDFs with no detectable tables.
    Extracts raw text and structures it as key-value pairs.
    """
    rows = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            for line in text.strip().split("\n"):
                line = line.strip()
                if not line:
                    continue
                # Try to split as key: value
                if ":" in line:
                    parts = line.split(":", 1)
                    rows.append({
                        "Field": parts[0].strip(),
                        "Value": parts[1].strip()
                    })
                else:
                    rows.append({
                        "Field": line,
                        "Value": ""
                    })

    if not rows:
        raise ValueError("No content found in PDF")

    return pd.DataFrame(rows)


def combine_pdf_tables(dfs: list) -> pd.DataFrame:
    """
    Intelligently combines multiple tables from a PDF.
    Strategy 1 — Same columns: stack vertically
    Strategy 2 — Different columns: concatenate side by side
    Strategy 3 — Mix: keep largest + append others as new rows
    """
    if not dfs:
        raise ValueError("No tables to combine")

    # Check if all tables share the same columns
    # (ignoring _page and _table_index metadata cols)
    def get_data_cols(df):
        return set(c for c in df.columns
                   if c not in ["_page", "_table_index"])

    first_cols = get_data_cols(dfs[0])
    all_same = all(
        get_data_cols(df) == first_cols
        for df in dfs
    )

    if all_same:
        # Stack all tables vertically
        combined = pd.concat(dfs, ignore_index=True)
        return combined

    # Different columns — try outer join concat
    try:
        combined = pd.concat(dfs, ignore_index=True)
        return combined
    except Exception:
        # Last resort — return the largest table
        return max(dfs, key=len)


def load_image(file_path: str) -> pd.DataFrame:
    """
    Extract text from scanned image using OCR (Tesseract),
    then parse it into a DataFrame.
    """
    image = Image.open(file_path)

    # Run OCR on the image
    text = pytesseract.image_to_string(image)

    # Try to parse as CSV-like structure
    lines = [line.strip() for line in text.strip().split("\n") if line.strip()]

    if len(lines) < 2:
        raise ValueError("Could not extract table data from image")

    # Parse lines into rows
    rows = []
    for line in lines:
        # Split by common delimiters
        if "\t" in line:
            rows.append(line.split("\t"))
        elif "," in line:
            rows.append(line.split(","))
        else:
            rows.append(line.split())

    # Use first row as headers
    headers = rows[0]
    data = rows[1:]

    # Ensure all rows have same length
    data = [row for row in data if len(row) == len(headers)]

    return pd.DataFrame(data, columns=headers)


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean the DataFrame:
    - Strip whitespace from column names
    - Remove completely empty rows
    - Strip whitespace from string values
    - Convert numeric strings to numbers where possible
    """
    # Clean column names
    df.columns = [str(col).strip() for col in df.columns]

    # Remove completely empty rows
    df = df.dropna(how="all")

    # Strip whitespace from string columns
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].astype(str).str.strip()
        df[col] = df[col].replace("nan", None)

    # Try to convert object columns to numeric
    for col in df.select_dtypes(include=["object"]).columns:
        try:
            df[col] = pd.to_numeric(df[col])
        except (ValueError, TypeError):
            pass

    return df