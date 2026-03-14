import pandas as pd
from typing import Dict

dataset_store: Dict[str, pd.DataFrame] = {}

def get_dataset(session_id: str) -> pd.DataFrame | None:
    """Get a dataset by session ID"""
    return dataset_store.get(session_id)

def set_dataset(session_id: str, df: pd.DataFrame):
    """Store a dataset by session ID"""
    dataset_store[session_id] = df

def delete_dataset(session_id: str):
    """Remove a dataset from memory"""
    if session_id in dataset_store:
        del dataset_store[session_id]

def has_dataset(session_id: str) -> bool:
    """Check if a dataset exists for a session"""
    return session_id in dataset_store