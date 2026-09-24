"""Smoke-check local E5 query retrieval; ranks are not screen-recognition accuracy."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from build_text_embeddings import embed_batch
from sync_text_embeddings import read_artifact


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--queries", type=Path, required=True)
    parser.add_argument("--device", choices=("cpu", "mps"), default="cpu")
    args = parser.parse_args()

    import numpy as np
    from transformers import AutoModel, AutoTokenizer

    _, rows = read_artifact(args.artifact)
    queries = json.loads(args.queries.read_text())
    if not isinstance(queries, list) or not queries:
        raise ValueError("Expected nonempty query array")
    tokenizer = AutoTokenizer.from_pretrained(args.model_dir, local_files_only=True)
    model = AutoModel.from_pretrained(args.model_dir, local_files_only=True, use_safetensors=True).to(args.device).eval()
    vectors = np.asarray([row["embedding"] for row in rows], dtype=np.float32)
    for query in queries:
        if query.get("locale") not in ("ko", "en", "ja") or not isinstance(query.get("text"), str):
            raise ValueError("Invalid locale or query text")
        vector = np.asarray(embed_batch([query["text"]], model, tokenizer, args.device, prefix="query")[0], dtype=np.float32)
        relevant = [index for index, row in enumerate(rows) if row["locale"] == query["locale"] and row["entity_kind"] == query["entity_kind"]]
        scores = vectors[relevant] @ vector
        ranked = [relevant[index] for index in np.argsort(-scores)]
        expected = next((position + 1 for position, index in enumerate(ranked)
                         if rows[index]["entity_id"] == query["entity_id"] and rows[index]["field_name"] == query["field_name"]), None)
        print(json.dumps({"label": query.get("label"), "locale": query["locale"], "kind": query["entity_kind"],
                          "expected_rank": expected,
                          "top3": [{"id": rows[index]["entity_id"], "field": rows[index]["field_name"],
                                    "similarity": round(float(vectors[index] @ vector), 4)} for index in ranked[:3]]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
