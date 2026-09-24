"""Validate a complete vector artifact; optionally atomically sync derived rows.

Default is local dry-run. `--apply` requires a reviewed source hash and a direct
ASSIST_DATABASE_URL. Only limbus.assist_text_embeddings is written.
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
from pathlib import Path

from build_text_embeddings import DIMENSIONS, MODEL_ID, MODEL_REVISION, PREPROCESS_VERSION, validate_vector

COLUMNS = (
    "model_id", "model_revision", "preprocess_version", "entity_kind", "entity_id", "locale",
    "field_name", "chunk_index", "token_start", "token_end", "source_hash", "content_hash",
    "content", "embedding",
)
KEY = ("model_id", "model_revision", "preprocess_version", "entity_kind", "entity_id", "locale", "field_name", "chunk_index")


def read_artifact(folder: Path):
    manifest = json.loads((folder / "manifest.json").read_text())
    expected = {"model_id": MODEL_ID, "model_revision": MODEL_REVISION,
                "preprocess_version": PREPROCESS_VERSION, "dimensions": DIMENSIONS}
    for name, value in expected.items():
        if manifest.get(name) != value:
            raise ValueError(f"Wrong manifest {name}")
    rows = []
    keys = set()
    fields = set()
    chunks_by_field = {}
    with gzip.open(folder / "vectors.jsonl.gz", "rt", encoding="utf-8") as source:
        for line in source:
            row = json.loads(line)
            if any(name not in row for name in COLUMNS):
                raise ValueError("Incomplete vector row")
            if any(row[name] != manifest[name] for name in ("model_id", "model_revision", "preprocess_version")):
                raise ValueError("Mixed model or preprocessing")
            validate_vector(row["embedding"])
            key = tuple(row[name] for name in KEY)
            if key in keys:
                raise ValueError("Duplicate vector key")
            keys.add(key)
            field = key[:-1]
            fields.add(field)
            chunks_by_field.setdefault(field, []).append(row)
            rows.append(row)
    if len(rows) != manifest["chunk_count"] or len(fields) != manifest["field_count"]:
        raise ValueError("Artifact does not cover manifest fields and chunks")
    for group in chunks_by_field.values():
        group.sort(key=lambda row: row["chunk_index"])
        if [row["chunk_index"] for row in group] != list(range(len(group))):
            raise ValueError("Missing chunk index")
        if len({row["source_hash"] for row in group}) != 1:
            raise ValueError("Mixed source hashes within field")
        if group[0]["token_start"] != 0:
            raise ValueError("Missing first tokens")
        for previous, current in zip(group, group[1:]):
            if current["token_start"] > previous["token_end"] or current["token_end"] <= previous["token_end"]:
                raise ValueError("Token gap or invalid overlap")
    return manifest, rows


def apply_rows(rows: list[dict], manifest: dict, database_url: str):
    import psycopg

    # One transaction: a partial copy/upsert never replaces the previous full snapshot.
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                create temp table assist_text_stage (
                  model_id text, model_revision text, preprocess_version text,
                  entity_kind text, entity_id integer, locale text, field_name text,
                  chunk_index integer, token_start integer, token_end integer,
                  source_hash text, content_hash text, content text,
                  embedding public.vector(384)
                ) on commit drop
            """)
            with cursor.copy("copy assist_text_stage (" + ",".join(COLUMNS) + ") from stdin") as copy:
                for row in rows:
                    values = [row[name] for name in COLUMNS]
                    values[-1] = "[" + ",".join(format(value, ".9g") for value in row["embedding"]) + "]"
                    copy.write_row(values)
            cursor.execute("select count(*) from assist_text_stage")
            if cursor.fetchone()[0] != manifest["chunk_count"]:
                raise ValueError("Staging row count mismatch")
            cursor.execute("""
                insert into limbus.assist_text_embeddings as target (
                  model_id, model_revision, preprocess_version, entity_kind, entity_id, locale,
                  field_name, chunk_index, token_start, token_end, source_hash, content_hash,
                  content, embedding
                )
                select model_id, model_revision, preprocess_version, entity_kind, entity_id, locale,
                  field_name, chunk_index, token_start, token_end, source_hash, content_hash,
                  content, embedding from assist_text_stage
                on conflict (model_id, model_revision, preprocess_version, entity_kind, entity_id,
                             locale, field_name, chunk_index)
                do update set token_start = excluded.token_start, token_end = excluded.token_end,
                  source_hash = excluded.source_hash, content_hash = excluded.content_hash,
                  content = excluded.content, embedding = excluded.embedding, updated_at = now()
                where (target.source_hash, target.content_hash, target.token_start, target.token_end)
                  is distinct from (excluded.source_hash, excluded.content_hash, excluded.token_start, excluded.token_end)
            """)
            changed = cursor.rowcount
            cursor.execute("""
                delete from limbus.assist_text_embeddings as target
                where target.model_id = %s and target.model_revision = %s
                  and target.preprocess_version = %s
                  and not exists (
                    select 1 from assist_text_stage as staged
                    where staged.model_id = target.model_id
                      and staged.model_revision = target.model_revision
                      and staged.preprocess_version = target.preprocess_version
                      and staged.entity_kind = target.entity_kind
                      and staged.entity_id = target.entity_id
                      and staged.locale = target.locale
                      and staged.field_name = target.field_name
                      and staged.chunk_index = target.chunk_index
                  )
            """, (MODEL_ID, MODEL_REVISION, PREPROCESS_VERSION))
            removed = cursor.rowcount
            cursor.execute("""select count(*) from limbus.assist_text_embeddings
                where model_id = %s and model_revision = %s and preprocess_version = %s""",
                (MODEL_ID, MODEL_REVISION, PREPROCESS_VERSION))
            final_count = cursor.fetchone()[0]
            if final_count != manifest["chunk_count"]:
                raise ValueError("Post-sync row count mismatch")
    return {"changed": changed, "removed_stale_derived_rows": removed, "final_count": final_count}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expect-source-hash")
    args = parser.parse_args()
    manifest, rows = read_artifact(args.artifact)
    if args.apply:
        if not args.expect_source_hash or args.expect_source_hash != manifest["source_sha256"]:
            parser.error("--apply requires the exact reviewed --expect-source-hash")
        database_url = os.environ.get("ASSIST_DATABASE_URL")
        if not database_url:
            parser.error("ASSIST_DATABASE_URL is required for --apply")
        print(json.dumps(apply_rows(rows, manifest, database_url)))
    else:
        print(json.dumps({"dry_run": True, "source_sha256": manifest["source_sha256"],
                          "fields": manifest["field_count"], "vectors": len(rows),
                          "kinds_locales": manifest["fields_by_kind_locale"]}))


if __name__ == "__main__":
    main()
