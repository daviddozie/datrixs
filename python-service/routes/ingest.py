from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import pandas as pd
import pdfplumber
import pytesseract
from PIL import Image
import json
import os
import tempfile
import shutil

from store import set_dataset, get_dataset
from embeddings import index_dataset

router = APIRouter()

class IngestResponse(BaseModel):
    success: bool
    fileId: str
    rowCount: int
    columnCount: int
    columns: list[str]
    preview: list[dict]

@router.post("/ingest", response_model=IngestResponse)
async def ingest_file(
    fileId: str = Form(...),
    sessionId: str = Form(...),
    fileType: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Receives a file upload from Next.js, reads it into a pandas DataFrame,
    stores it, and returns metadata about the dataset.
    Works in both local and cloud deployments.
    """
    tmp_path = None
    try:
        # Save the uploaded bytes to a temp file so existing loaders work unchanged
        suffix = "." + (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else fileType)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Load file based on type
        df = load_file(tmp_path, fileType)

        if df is None or df.empty:
            raise HTTPException(
                status_code=400,
                detail="Could not extract data from file"
            )

        # Clean the dataframe
        df = clean_dataframe(df)

        # Store under fileId for individual file access
        set_dataset(fileId, df)

        # Store under sessionId for agent queries
        # If session already has data, append to avoid losing
        # previously uploaded files in the same session
        existing = get_dataset(sessionId)
        if existing is not None:
            combined = pd.concat([existing, df], ignore_index=True)
            combined = combined.drop_duplicates()
            set_dataset(sessionId, combined)
        else:
            set_dataset(sessionId, df)
        try:
            final_df = get_dataset(sessionId)
            if final_df is not None:
                index_dataset(sessionId, final_df)
        except Exception as e:
            # Don't fail upload if indexing fails
            print(f"Warning: RAG indexing failed: {e}")

        # Return metadata about the dataset
        preview = df.head(5).fillna("").to_dict(orient="records")

        return IngestResponse(
            success=True,
            fileId=fileId,
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
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

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
    Extract a table from a scanned image using OCR (Tesseract).
    Runs OCR on both the normal and inverted image so white-on-dark
    header text is captured, then uses pixel-position column clustering
    to correctly group multi-word cells like 'Computer Science'.
    """
    try:
        image = Image.open(file_path).convert("RGB")
    except Exception as e:
        raise ValueError(f"Could not open image file: {e}")

    try:
        df = _parse_image_via_tsv(image)
        if df is not None and not df.empty:
            return df
    except pytesseract.TesseractNotFoundError:
        raise ValueError(
            "Tesseract OCR is not installed. "
            "Install it with: brew install tesseract (Mac) or "
            "sudo apt-get install tesseract-ocr (Linux)"
        )
    except Exception:
        pass

    # Fallback: plain text extraction
    try:
        text = pytesseract.image_to_string(image)
    except pytesseract.TesseractNotFoundError:
        raise ValueError(
            "Tesseract OCR is not installed. "
            "Install it with: brew install tesseract (Mac) or "
            "sudo apt-get install tesseract-ocr (Linux)"
        )

    lines = [line.strip() for line in text.strip().split("\n") if line.strip()]
    if len(lines) < 2:
        if lines:
            return pd.DataFrame({"extracted_text": lines})
        raise ValueError(
            "Could not extract table data from image. "
            "Ensure the image contains a clear, readable table."
        )

    rows = []
    for line in lines:
        if "\t" in line:
            rows.append(line.split("\t"))
        elif "," in line:
            rows.append(line.split(","))
        elif "|" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if parts:
                rows.append(parts)
        else:
            rows.append(line.split())

    if not rows:
        raise ValueError("Could not parse any rows from the image")

    headers = rows[0]
    data = rows[1:]
    if not data:
        return pd.DataFrame([headers], columns=[f"col_{i}" for i in range(len(headers))])

    clean_data = []
    for row in data:
        if len(row) < len(headers):
            row = row + [""] * (len(headers) - len(row))
        elif len(row) > len(headers):
            row = row[:len(headers)]
        clean_data.append(row)

    return pd.DataFrame(clean_data, columns=headers)


def _extract_header_from_dark_bg(image, y_start: int, y_end: int) -> list[str] | None:
    """
    Recover column headers from a row with a dark/coloured background and
    white (or near-white) text.  Strategy:
      1. Crop the exact header band.
      2. Build a binary image: white-ish pixels → black (ink), rest → white (paper).
      3. Scale up 4× so Tesseract can resolve individual glyphs.
      4. Run OCR with PSM 11 (sparse text, any orientation).
    Returns a list of header strings, or None if nothing useful is found.
    """
    import numpy as np
    from PIL import Image as PILImage

    arr = np.array(image)
    w = image.width
    band = arr[y_start:y_end, :, :]

    # Pixels that are near-white (text colour) – R,G,B all > 200
    white_mask = (band[:, :, 0] > 200) & (band[:, :, 1] > 200) & (band[:, :, 2] > 200)
    if white_mask.sum() < 50:          # not enough white pixels → give up
        return None

    # Binary image: white text becomes black ink on white paper
    binary = np.full((band.shape[0], w), 255, dtype=np.uint8)
    binary[white_mask] = 0

    bin_img = PILImage.fromarray(binary)
    # Scale up 4× so Tesseract can read the small glyphs
    big = bin_img.resize((w * 4, bin_img.height * 4), PILImage.NEAREST)

    text = pytesseract.image_to_string(big, config="--psm 11").strip()
    # Filter out noise tokens
    tokens = [
        t.strip() for t in text.split()
        if t.strip() and t.strip().replace(" ", "").isalpha() and len(t.strip()) > 1
    ]
    if len(tokens) == 0:
        return None
    return tokens


def _parse_image_via_tsv(image) -> pd.DataFrame:
    """
    Use Tesseract TSV output to reconstruct table columns by pixel position.
    Also runs OCR on an inverted copy to capture white-on-dark header text.
    Multi-word cells (e.g. 'Computer Science') are grouped by column proximity.
    For dark-background headers (coloured row with white text) a dedicated
    white-pixel extraction pass recovers the column names.
    """
    import numpy as np
    from PIL import ImageOps

    NOISE = {"|", "-", "_", "—", ""}

    def extract_line_groups(img):
        tsv = pytesseract.image_to_data(img, output_type=pytesseract.Output.DATAFRAME)
        words = tsv[
            (tsv["conf"] > 20) &
            (~tsv["text"].str.strip().isin(NOISE))
        ].copy()
        if words.empty:
            return []
        words["line_key"] = (
            words["block_num"].astype(str) + "_" +
            words["par_num"].astype(str) + "_" +
            words["line_num"].astype(str)
        )
        groups = []
        for _, grp in words.groupby("line_key", sort=False):
            grp = grp.sort_values("left")
            groups.append({
                "top": int(grp["top"].mean()),
                "words": grp[["left", "text"]].to_dict("records"),
            })
        groups.sort(key=lambda x: x["top"])
        return groups

    normal_lines = extract_line_groups(image)
    inverted_lines = extract_line_groups(ImageOps.invert(image))

    # Merge inverted lines that aren't already covered by normal OCR
    # (these are the white-on-dark header rows OCR normally misses)
    existing_tops = {lg["top"] for lg in normal_lines}
    merged = list(normal_lines)
    for il in inverted_lines:
        if not any(abs(il["top"] - t) < 25 for t in existing_tops):
            merged.append(il)
            existing_tops.add(il["top"])
    merged.sort(key=lambda x: x["top"])

    if not merged:
        return None

    # Determine the true column count: use the median word-count across lines
    # to avoid letting a noisy line dictate the column count
    word_counts = [len(lg["words"]) for lg in merged]
    col_count = int(np.median(word_counts))
    if col_count < 1:
        return None

    # Anchor column centres on the first line that matches col_count
    anchor = next(
        (lg for lg in merged if len(lg["words"]) == col_count),
        merged[0]
    )
    col_centres = sorted([w["left"] for w in anchor["words"]])

    def assign_col(left_pos):
        return int(np.argmin([abs(left_pos - c) for c in col_centres]))

    # Build rows — group words into cells by nearest column centre
    raw_rows = []
    for line in merged:
        row_cells = [""] * col_count
        for word in line["words"]:
            idx = assign_col(word["left"])
            if idx < col_count:
                row_cells[idx] = (row_cells[idx] + " " + word["text"]).strip()
        if any(cell.strip() for cell in row_cells):
            raw_rows.append(row_cells)

    if not raw_rows:
        return None

    # Detect whether first row is a header (short alpha words) or data
    def looks_like_header(row):
        non_empty = [c for c in row if c.strip()]
        if not non_empty:
            return False
        return all(
            c.replace(" ", "").isalpha() and len(c.split()) <= 2
            for c in non_empty
        )

    # Step 1: try to detect a dark-background header band (coloured row with
    # white text) that Tesseract missed in both normal and inverted passes.
    # We do this BEFORE deciding on the final col_count so that, if the header
    # gives us the authoritative column count, we can re-cluster the data rows.

    arr = np.array(image)
    per_row_mean = arr.mean(axis=1)   # shape (h, 3), mean across all pixels
    h_img = image.height
    dark_start = None
    dark_end = None
    for row_idx in range(min(h_img, 200)):
        is_dark = float(per_row_mean[row_idx].mean()) < 210
        if is_dark and dark_start is None:
            dark_start = row_idx
        if not is_dark and dark_start is not None and dark_end is None:
            dark_end = row_idx
            break
    if dark_start is not None and dark_end is None:
        dark_end = min(h_img, dark_start + 100)

    dark_headers = None
    if dark_start is not None:
        dark_headers = _extract_header_from_dark_bg(image, dark_start, dark_end)
        if not dark_headers:
            dark_headers = None

    if not raw_rows:
        return None

    # Step 2: decide on final headers and data rows
    if dark_headers:
        # col_count comes from the data rows (most reliable pixel clustering).
        # Pad or trim dark_headers to match.
        if len(dark_headers) < col_count:
            dark_headers = dark_headers + [
                f"Column_{i + 1}" for i in range(len(dark_headers), col_count)
            ]
        elif len(dark_headers) > col_count:
            dark_headers = dark_headers[:col_count]
        headers = dark_headers
        data_rows = raw_rows          # all OCR rows are data (header was on dark bg)
    elif looks_like_header(raw_rows[0]):
        headers = raw_rows[0]
        data_rows = raw_rows[1:]
    else:
        headers = [f"Column_{i + 1}" for i in range(col_count)]
        data_rows = raw_rows

    if not data_rows:
        return pd.DataFrame([headers], columns=headers)

    return pd.DataFrame(data_rows, columns=headers)


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