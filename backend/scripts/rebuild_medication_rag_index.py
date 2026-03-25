from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.medication.guideline_rag import (
    DEFAULT_GUIDELINE_DATASET_PATH,
    DEFAULT_GUIDELINE_INDEX_PATH,
    build_guideline_index,
)
from services.medication.rag_index import build_medication_index, DEFAULT_DATASET_PATH, DEFAULT_INDEX_PATH


def main() -> None:
    payload = build_medication_index(dataset_path=DEFAULT_DATASET_PATH, index_path=DEFAULT_INDEX_PATH)
    guideline_payload = build_guideline_index(
        dataset_path=DEFAULT_GUIDELINE_DATASET_PATH,
        index_path=DEFAULT_GUIDELINE_INDEX_PATH,
    )
    print(
        "Medication RAG index built:",
        {
            "dataset_path": str(DEFAULT_DATASET_PATH),
            "index_path": str(DEFAULT_INDEX_PATH),
            "drug_count": len(payload.get("entries") or []),
            "chunk_count": len(payload.get("chunks") or []),
        },
    )
    print(
        "Guideline RAG index built:",
        {
            "dataset_path": str(DEFAULT_GUIDELINE_DATASET_PATH),
            "index_path": str(DEFAULT_GUIDELINE_INDEX_PATH),
            "entry_count": len(guideline_payload.get("entries") or []),
        },
    )


if __name__ == "__main__":
    main()
