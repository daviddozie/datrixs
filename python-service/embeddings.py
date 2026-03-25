import lancedb
import pandas as pd
import numpy as np
import os
from fastembed import TextEmbedding

# Model setup
MODEL_NAME = "BAAI/bge-small-en-v1.5"
_model = None

def get_model() -> TextEmbedding:
    """Lazy load the embedding model"""
    global _model
    if _model is None:
        print(f"Loading embedding model: {MODEL_NAME}")
        _model = TextEmbedding(MODEL_NAME)
        print("Embedding model loaded!")
    return _model


# LanceDB setup
DB_PATH = os.path.join(os.path.dirname(__file__), "lancedb")

def get_db():
    """Get LanceDB connection"""
    return lancedb.connect(DB_PATH)


# Core functions

def embed_text(text: str) -> list[float]:
    """Convert a single text string to an embedding vector"""
    model = get_model()
    embeddings = list(model.embed([text]))
    return embeddings[0].tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Convert multiple texts to embeddings efficiently"""
    model = get_model()
    embeddings = list(model.embed(texts))
    return [e.tolist() for e in embeddings]


def dataframe_to_texts(df: pd.DataFrame) -> list[str]:
    """
    Convert each row of a DataFrame to a text representation.
    This is what gets embedded — each row becomes a sentence
    that captures all its column values.

    Example row:
    order_id=1001, product=Laptop Pro, region=North,
    revenue=14400.0, profit=4800.0
    → "order_id is 1001. product is Laptop Pro. region is North.
       revenue is 14400.0. profit is 4800.0."
    """
    texts = []
    for _, row in df.iterrows():
        # Build a natural language description of the row
        parts = []
        for col, val in row.items():
            if pd.notna(val) and str(val).strip() not in ("", "nan", "None"):
                # Format numeric values cleanly
                if isinstance(val, (int, float)):
                    parts.append(f"{col} is {val:.2f}" if isinstance(val, float) else f"{col} is {val}")
                else:
                    parts.append(f"{col} is {val}")
        texts.append(". ".join(parts) + ".")
    return texts


def index_dataset(session_id: str, df: pd.DataFrame) -> int:
    """
    Index a DataFrame into LanceDB for semantic search.
    Each row becomes a vector in the database.
    Returns the number of rows indexed.
    """
    try:
        db = get_db()
        table_name = f"session_{session_id.replace('-', '_')}"

        # Convert rows to text
        texts = dataframe_to_texts(df)

        # Generate embeddings for all rows
        print(f"Generating embeddings for {len(texts)} rows...")
        embeddings = embed_texts(texts)
        print(f"Embeddings generated!")

        # Build records for LanceDB
        # Each record has: text, embedding, and all original columns
        records = []
        for i, (text, embedding) in enumerate(zip(texts, embeddings)):
            record = {
                "id": i,
                "text": text,
                "vector": embedding,
                "row_index": i,
            }
            # Add original column values as metadata
            row = df.iloc[i]
            for col in df.columns:
                val = row[col]
                if pd.isna(val):
                    record[f"col_{col}"] = ""
                elif isinstance(val, (int, float)):
                    record[f"col_{col}"] = str(val)
                else:
                    record[f"col_{col}"] = str(val)
            records.append(record)

        # Drop existing table for this session if it exists
        existing_tables = db.table_names()
        if table_name in existing_tables:
            db.drop_table(table_name)

        # Create new table with records
        db.create_table(table_name, records)
        print(f"Indexed {len(records)} rows into LanceDB table: {table_name}")

        return len(records)

    except Exception as e:
        print(f"Error indexing dataset: {e}")
        raise


def search_similar(
    session_id: str,
    query: str,
    top_k: int = 10
) -> list[dict]:
    """
    Search for rows most semantically similar to the query.
    Returns top_k most relevant rows as a list of dicts.

    Example:
    query = "highest revenue laptop sales"
    → Returns rows about laptop products with high revenue
    """
    try:
        db = get_db()
        table_name = f"session_{session_id.replace('-', '_')}"

        # Check table exists
        if table_name not in db.table_names():
            return []

        # Embed the query
        query_embedding = embed_text(query)

        # Search LanceDB
        table = db.open_table(table_name)
        results = (
            table.search(query_embedding)
            .limit(top_k)
            .to_pandas()
        )

        # Convert results back to readable dicts
        rows = []
        for _, result in results.iterrows():
            row = {"_similarity_text": result.get("text", "")}
            # Extract original column values
            for col in result.index:
                if col.startswith("col_"):
                    original_col = col[4:]  # Remove "col_" prefix
                    row[original_col] = result[col]
            rows.append(row)

        return rows

    except Exception as e:
        print(f"Error searching embeddings: {e}")
        return []


def delete_session_index(session_id: str):
    """Delete the LanceDB index for a session"""
    try:
        db = get_db()
        table_name = f"session_{session_id.replace('-', '_')}"
        if table_name in db.table_names():
            db.drop_table(table_name)
            print(f"Deleted index for session: {session_id}")
    except Exception as e:
        print(f"Error deleting index: {e}")