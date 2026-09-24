"""Build a private, reproducible E5 corpus from a read-only game catalog JSON.

The input has `gifts`, `events`, and `choices` arrays. This command never writes to a
database or calls an inference API. Install versions in requirements.txt in a private
virtual environment; download the pinned model revision separately.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import html
import json
import math
import re
from collections import Counter
from pathlib import Path

MODEL_ID = "intfloat/multilingual-e5-small"
MODEL_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
MODEL_SHA256 = "1a55775f53449dac10a2bcbc312469fac40b96d53198c407081a831f81c98477"
PREPROCESS_VERSION = "display-text-v1"
DIMENSIONS = 384
CHUNK_TOKENS = 384
CHUNK_OVERLAP = 32

FIELDS = {
    "gifts": ("gift", "game_id", ("name", "effect_base", "effect_plus", "effect_plusplus")),
    "events": ("event", "id", ("name", "desc_text")),
    "choices": ("choice", "id", ("message", "message_desc", "result_text")),
}
LOCALE_SUFFIX = {"ko": "", "en": "_en", "ja": "_jp"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()


def display_text(raw: str) -> str:
    # The source contains narrative <…> text. Remove only verified color tags.
    value = re.sub(r"</?color\b[^>]*>", "", raw, flags=re.IGNORECASE)
    return html.unescape(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def iter_fields(source: dict):
    if set(source) != set(FIELDS):
        raise ValueError("Catalog must contain gifts, events, and choices")
    for collection, (kind, id_field, field_names) in FIELDS.items():
        rows = source[collection]
        if not isinstance(rows, list):
            raise ValueError(f"{collection} must be an array")
        seen_ids = set()
        for row in rows:
            entity_id = row.get(id_field)
            if not isinstance(entity_id, int) or entity_id <= 0 or entity_id in seen_ids:
                raise ValueError(f"Invalid or duplicate {kind} ID")
            seen_ids.add(entity_id)
            for field_name in field_names:
                for locale, suffix in LOCALE_SUFFIX.items():
                    column = field_name + suffix
                    raw = row.get(column)
                    if raw is None or raw == "":
                        continue
                    if not isinstance(raw, str):
                        raise ValueError(f"Invalid {kind}.{column}")
                    if not raw.strip():
                        continue
                    rendered = display_text(raw)
                    if not rendered:
                        raise ValueError(f"Nonempty source became empty: {kind}.{column}")
                    yield {
                        "entity_kind": kind,
                        "entity_id": entity_id,
                        "locale": locale,
                        "field_name": field_name,
                        "source_hash": sha256(raw.encode("utf-8")),
                        "content": rendered,
                    }


def chunk_field(field: dict, tokenizer) -> list[dict]:
    tokens = tokenizer.encode(field["content"], add_special_tokens=False, verbose=False)
    if not tokens:
        raise ValueError("Nonempty field has no tokens")
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_TOKENS, len(tokens))
        text = field["content"] if start == 0 and end == len(tokens) else tokenizer.decode(
            tokens[start:end], skip_special_tokens=True, clean_up_tokenization_spaces=False
        ).strip()
        if not text:
            raise ValueError("Tokenizer produced empty chunk")
        chunks.append({
            **field,
            "chunk_index": len(chunks),
            "token_start": start,
            "token_end": end,
            "content": text,
            "content_hash": sha256(text.encode("utf-8")),
            "model_id": MODEL_ID,
            "model_revision": MODEL_REVISION,
            "preprocess_version": PREPROCESS_VERSION,
        })
        if end == len(tokens):
            break
        start = end - CHUNK_OVERLAP
    if chunks[-1]["token_end"] != len(tokens):
        raise ValueError("Token coverage incomplete")
    return chunks


def validate_vector(vector: list[float]) -> None:
    if len(vector) != DIMENSIONS or not all(math.isfinite(value) for value in vector):
        raise ValueError("Invalid embedding dimensions or values")
    norm = math.sqrt(sum(value * value for value in vector))
    if abs(norm - 1.0) > 0.001:
        raise ValueError("Embedding is not L2 normalized")


def embed_batch(texts: list[str], model, tokenizer, device: str, prefix: str = "passage") -> list[list[float]]:
    import torch

    if prefix not in ("passage", "query"):
        raise ValueError("E5 prefix must be passage or query")
    batch = tokenizer([prefix + ": " + text for text in texts], padding=True, return_tensors="pt")
    if batch["input_ids"].shape[1] > 512:
        raise ValueError("Chunk exceeded E5's 512 token limit")
    batch = {key: value.to(device) for key, value in batch.items()}
    with torch.inference_mode():
        hidden = model(**batch).last_hidden_state
        mask = batch["attention_mask"].unsqueeze(-1)
        pooled = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1)
        normalized = torch.nn.functional.normalize(pooled, p=2, dim=1)
    result = normalized.cpu().tolist()
    for vector in result:
        validate_vector(vector)
    return result


def chunk_key(chunk: dict) -> tuple:
    return tuple(chunk[name] for name in ("entity_kind", "entity_id", "locale", "field_name", "chunk_index"))


def load_reusable(reuse_dir: Path, manifest: dict) -> dict[tuple, dict]:
    prior = json.loads((reuse_dir / "manifest.json").read_text())
    for key in ("model_id", "model_revision", "model_sha256", "tokenizer_sha256", "preprocess_version", "dimensions"):
        if prior.get(key) != manifest[key]:
            raise ValueError(f"Incompatible reuse artifact: {key}")
    reusable = {}
    with gzip.open(reuse_dir / "vectors.jsonl.gz", "rt", encoding="utf-8") as stream:
        for line in stream:
            row = json.loads(line)
            key = chunk_key(row)
            if key in reusable:
                raise ValueError("Duplicate key in reusable artifact")
            validate_vector(row["embedding"])
            reusable[key] = row
    if len(reusable) != prior["chunk_count"]:
        raise ValueError("Reusable artifact has missing rows")
    return reusable


def build(source_path: Path, model_dir: Path, output_dir: Path, batch_size: int, dry_run: bool, device: str, reuse_dir: Path | None):
    from transformers import AutoModel, AutoTokenizer

    if reuse_dir and reuse_dir.resolve() == output_dir.resolve():
        raise ValueError("Reuse artifact and output directory must differ")
    source_bytes = source_path.read_bytes()
    source = json.loads(source_bytes)
    fields = list(iter_fields(source))
    tokenizer = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)
    chunks = [chunk for field in fields for chunk in chunk_field(field, tokenizer)]
    keys = [chunk_key(chunk) for chunk in chunks]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate embedding key")
    counts = Counter((field["entity_kind"], field["locale"]) for field in fields)
    manifest = {
        "model_id": MODEL_ID,
        "model_revision": MODEL_REVISION,
        "model_sha256": MODEL_SHA256,
        "tokenizer_sha256": sha256((model_dir / "tokenizer.json").read_bytes()),
        "preprocess_version": PREPROCESS_VERSION,
        "source_sha256": sha256(source_bytes),
        "dimensions": DIMENSIONS,
        "field_count": len(fields),
        "chunk_count": len(chunks),
        "fields_by_kind_locale": {f"{kind}.{locale}": count for (kind, locale), count in sorted(counts.items())},
        "source_rows": {kind: len(source[kind]) for kind in FIELDS},
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    if dry_run:
        return manifest
    if sha256_file(model_dir / "model.safetensors") != MODEL_SHA256:
        raise ValueError("Pinned model weights hash mismatch")
    old = load_reusable(reuse_dir, manifest) if reuse_dir else {}
    vectors = [None] * len(chunks)
    missing = []
    for index, chunk in enumerate(chunks):
        prior = old.get(chunk_key(chunk))
        if prior and all(prior.get(key) == chunk[key] for key in ("source_hash", "content_hash", "token_start", "token_end")):
            vectors[index] = prior["embedding"]
        else:
            missing.append(index)
    print(f"reused {len(chunks) - len(missing)} chunks; generating {len(missing)}", flush=True)
    if missing:
        model = AutoModel.from_pretrained(model_dir, local_files_only=True, use_safetensors=True).to(device).eval()
        for offset in range(0, len(missing), batch_size):
            indices = missing[offset:offset + batch_size]
            fresh = embed_batch([chunks[index]["content"] for index in indices], model, tokenizer, device)
            for index, vector in zip(indices, fresh, strict=True):
                vectors[index] = vector
            if offset % (batch_size * 20) == 0:
                print(f"embedded {min(offset + batch_size, len(missing))}/{len(missing)}", flush=True)
    output_path = output_dir / "vectors.jsonl.gz"
    with output_path.open("wb") as stream, gzip.GzipFile(fileobj=stream, mode="wb", mtime=0) as compressed:
        for chunk, vector in zip(chunks, vectors, strict=True):
            validate_vector(vector)
            compressed.write((json.dumps({**chunk, "embedding": vector}, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8"))
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--device", choices=("cpu", "mps"), default="cpu")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--reuse-from", type=Path)
    args = parser.parse_args()
    if args.batch_size < 1 or args.batch_size > 128:
        parser.error("batch-size must be 1..128")
    print(json.dumps(build(args.source, args.model_dir, args.output_dir, args.batch_size, args.dry_run, args.device, args.reuse_from)))


if __name__ == "__main__":
    main()
