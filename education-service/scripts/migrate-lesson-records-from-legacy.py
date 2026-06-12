#!/usr/bin/env python3
"""
Dry-run reconciliation: speakasap-portal lesson records -> education-service.

This script is intentionally read-only. It reports source rows, normalized object
keys, part membership, target lesson availability, and conflicts before any
schema or data migration is implemented.

Env:
  EDUCATION_SOURCE_DATABASE_URL or SOURCE_DATABASE_URL
  EDUCATION_TARGET_DATABASE_URL or TARGET_DATABASE_URL (required with --check-target)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from typing import Any

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Install psycopg2-binary: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


OLD_PREFIX = "courses/records/"
MODERN_KEY_RE = re.compile(r"^\d{4}/\d{2}/\d{2}/.+$")


def log(message: str) -> None:
    print(f"{datetime.now(timezone.utc).isoformat()} {message}", flush=True)


def source_url() -> str:
    return os.environ.get("EDUCATION_SOURCE_DATABASE_URL") or os.environ.get("SOURCE_DATABASE_URL", "")


def target_url() -> str:
    return os.environ.get("EDUCATION_TARGET_DATABASE_URL") or os.environ.get("TARGET_DATABASE_URL", "")


def connect(url: str):
    return psycopg2.connect(url, connect_timeout=30)


def json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def clean_key(value: Any) -> str:
    return str(value or "").strip().rstrip("/")


def normalize_parts(raw: Any) -> tuple[list[str], str | None]:
    if raw in (None, "", {}):
        return [], None
    if isinstance(raw, list):
        return [str(v) for v in raw if str(v).strip()], None
    if isinstance(raw, tuple):
        return [str(v) for v in raw if str(v).strip()], None
    if isinstance(raw, dict):
        values: list[str] = []
        for value in raw.values():
            if isinstance(value, (list, tuple)):
                values.extend(str(v) for v in value if str(v).strip())
            elif str(value).strip():
                values.append(str(value))
        return values, "parts_json_object"
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            return [], f"bad_parts_json:{exc.msg}"
        return normalize_parts(parsed)
    return [], f"unsupported_parts_type:{type(raw).__name__}"


def classify_key(key: str) -> str:
    if not key:
        return "empty"
    if key.startswith(OLD_PREFIX):
        stripped = key[len(OLD_PREFIX):]
        if MODERN_KEY_RE.match(stripped):
            return "old_prefix_modern"
        return "old_prefix_legacy"
    if MODERN_KEY_RE.match(key):
        return "canonical"
    return "other"


def canonical_lesson_key(lesson_start: Any, lesson_uuid: str) -> str | None:
    if not lesson_start:
        return None
    if isinstance(lesson_start, str):
        try:
            lesson_start = datetime.fromisoformat(lesson_start)
        except ValueError:
            return None
    if not isinstance(lesson_start, (datetime, date)):
        return None
    return f"{lesson_start:%Y/%m/%d}/lesson_{lesson_uuid}.mp3"


def state_for(record_key: str, processed: bool, unavailable: str, parts: list[str]) -> str:
    if record_key and processed:
        return "ready"
    if (record_key or parts) and not processed:
        return "processing"
    if processed and not record_key and not parts and unavailable:
        return "unavailable"
    if not record_key and not parts and not unavailable:
        return "none"
    return "inconsistent"


def fetch_source_records(src, limit: int) -> list[dict[str, Any]]:
    sql = """
        SELECT
          lr.uuid::text AS uuid,
          lr.lesson_id::text AS lesson_id,
          lr.record::text AS record,
          lr.created AS created,
          lr.processed AS processed,
          COALESCE(lr.record_unavailable, '') AS record_unavailable,
          lr.parts AS parts,
          l.uuid::text AS lesson_uuid,
          l.start AS lesson_start
        FROM education_lessonrecord lr
        LEFT JOIN education_lesson l ON l.uuid = lr.lesson_id
        ORDER BY lr.created, lr.uuid
    """
    if limit > 0:
        sql += " LIMIT %s"
        params: tuple[Any, ...] = (limit,)
    else:
        params = ()
    cur = src.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, params)
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    return rows


def fetch_source_parts(src) -> dict[str, str]:
    cur = src.cursor()
    cur.execute("SELECT uuid::text, part_file::text FROM education_lessonrecordpart")
    rows = {uuid: clean_key(part_file) for uuid, part_file in cur.fetchall()}
    cur.close()
    return rows


def fetch_target_lessons(tgt, lesson_ids: set[str]) -> set[str]:
    if not lesson_ids:
        return set()
    found: set[str] = set()
    cur = tgt.cursor()
    ids = sorted(lesson_ids)
    chunk_size = 1000
    for idx in range(0, len(ids), chunk_size):
        chunk = ids[idx:idx + chunk_size]
        cur.execute('SELECT "uuid"::text FROM "education_lesson" WHERE "uuid" = ANY(%s)', (chunk,))
        found.update(row[0] for row in cur.fetchall())
    cur.close()
    return found


def build_report(src, tgt, args) -> dict[str, Any]:
    records = fetch_source_records(src, args.limit)
    parts_by_uuid = fetch_source_parts(src)
    target_lessons = fetch_target_lessons(tgt, {r["lesson_id"] for r in records if r.get("lesson_id")},) if tgt else set()
    check_target = tgt is not None

    counts: Counter[str] = Counter()
    issues: dict[str, list[Any]] = defaultdict(list)
    part_to_record: dict[str, list[str]] = defaultdict(list)
    would_insert_records: list[str] = []
    would_insert_parts: list[str] = []
    would_update_existing: list[str] = []

    counts["source_lesson_records"] = len(records)
    counts["source_lesson_record_parts"] = len(parts_by_uuid)

    lesson_record_seen: Counter[str] = Counter()
    referenced_parts: set[str] = set()

    for row in records:
        record_uuid = row["uuid"]
        lesson_id = row.get("lesson_id") or ""
        lesson_uuid = row.get("lesson_uuid") or lesson_id
        lesson_record_seen[lesson_id] += 1

        record_key = clean_key(row.get("record"))
        parts, parts_warning = normalize_parts(row.get("parts"))
        processed = bool(row.get("processed"))
        unavailable = str(row.get("record_unavailable") or "").strip()
        state = state_for(record_key, processed, unavailable, parts)
        key_kind = classify_key(record_key)

        counts[f"records_{state}"] += 1
        counts[f"keys_{key_kind}"] += 1
        would_insert_records.append(record_uuid)

        if parts_warning:
            issues["bad_parts_json"].append({"lessonRecordUuid": record_uuid, "warning": parts_warning})

        if not row.get("lesson_uuid"):
            issues["missing_source_lesson"].append({"lessonRecordUuid": record_uuid, "lessonId": lesson_id})

        if check_target and lesson_id not in target_lessons:
            issues["missing_target_lessons"].append({"lessonRecordUuid": record_uuid, "lessonId": lesson_id})

        canonical_key = canonical_lesson_key(row.get("lesson_start"), lesson_uuid)
        if record_key and canonical_key:
            comparable_key = record_key[len(OLD_PREFIX):] if record_key.startswith(OLD_PREFIX) else record_key
            if comparable_key != canonical_key:
                issues["record_key_date_mismatch"].append({
                    "lessonRecordUuid": record_uuid,
                    "lessonUuid": lesson_uuid,
                    "recordKey": record_key,
                    "canonicalKey": canonical_key,
                })

        if key_kind == "old_prefix_modern":
            issues["old_prefix_keys"].append({"lessonRecordUuid": record_uuid, "recordKey": record_key})
        elif key_kind == "old_prefix_legacy":
            issues["legacy_prefix_keys_without_date"].append({"lessonRecordUuid": record_uuid, "recordKey": record_key})

        for part_uuid in parts:
            referenced_parts.add(part_uuid)
            part_to_record[part_uuid].append(record_uuid)
            if part_uuid not in parts_by_uuid:
                issues["parts_missing_rows"].append({"lessonRecordUuid": record_uuid, "partUuid": part_uuid})
            else:
                would_insert_parts.append(part_uuid)

    for lesson_id, n in lesson_record_seen.items():
        if lesson_id and n > 1:
            issues["duplicate_lesson_records"].append({"lessonId": lesson_id, "count": n})

    for part_uuid, record_uuids in part_to_record.items():
        if len(record_uuids) > 1:
            issues["part_referenced_by_multiple_records"].append({
                "partUuid": part_uuid,
                "lessonRecordUuids": record_uuids,
            })

    for part_uuid, part_key in parts_by_uuid.items():
        if part_uuid not in referenced_parts:
            issues["orphan_parts"].append({"partUuid": part_uuid, "partKey": part_key})

    counts["parts_missing_rows"] = len(issues["parts_missing_rows"])
    counts["parts_orphan_rows"] = len(issues["orphan_parts"])
    counts["missing_target_lesson"] = len(issues["missing_target_lessons"])
    counts["records_inconsistent"] += (
        len(issues["bad_parts_json"])
        + len(issues["missing_source_lesson"])
        + len(issues["missing_target_lessons"])
        + len(issues["parts_missing_rows"])
        + len(issues["duplicate_lesson_records"])
        + len(issues["part_referenced_by_multiple_records"])
    )

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "mode": "dry-run",
        "limit": args.limit or None,
        "checkTarget": check_target,
        "counts": dict(sorted(counts.items())),
        "issues": {key: values for key, values in sorted(issues.items())},
        "wouldInsertLessonRecords": sorted(set(would_insert_records)),
        "wouldInsertLessonRecordParts": sorted(set(would_insert_parts)),
        "wouldUpdateExisting": sorted(set(would_update_existing)),
        "notes": [
            "Read-only report; no source or target writes were performed.",
            "Object storage existence is not checked by this script version.",
        ],
    }
    return report


def print_summary(report: dict[str, Any]) -> None:
    counts = report["counts"]
    ordered_keys = [
        "source_lesson_records",
        "source_lesson_record_parts",
        "records_ready",
        "records_processing",
        "records_unavailable",
        "records_none",
        "records_inconsistent",
        "missing_target_lesson",
        "parts_missing_rows",
        "parts_orphan_rows",
        "keys_canonical",
        "keys_old_prefix_modern",
        "keys_old_prefix_legacy",
        "keys_empty",
        "keys_other",
    ]
    for key in ordered_keys:
        log(f"{key}={counts.get(key, 0)}")
    for key, values in report["issues"].items():
        log(f"issue {key}={len(values)}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Read-only mode. This is the only supported mode.")
    parser.add_argument("--check-target", action="store_true", help="Verify source lesson IDs exist in target education_lesson.")
    parser.add_argument("--limit", type=int, default=0, help="Limit source lesson records to inspect.")
    parser.add_argument("--json-report", default="", help="Write full JSON report to this path.")
    args = parser.parse_args()

    if not args.dry_run:
        log("Only --dry-run mode is implemented. Refusing to run without --dry-run.")
        return 2

    src_u = source_url()
    if not src_u:
        log("Missing EDUCATION_SOURCE_DATABASE_URL or SOURCE_DATABASE_URL")
        return 1

    tgt_u = target_url()
    if args.check_target and not tgt_u:
        log("Missing EDUCATION_TARGET_DATABASE_URL or TARGET_DATABASE_URL for --check-target")
        return 1

    src = connect(src_u)
    tgt = None
    try:
        if args.check_target:
            tgt = connect(tgt_u)
        report = build_report(src, tgt, args)
    finally:
        if tgt is not None:
            tgt.close()
        src.close()

    print_summary(report)
    if args.json_report:
        with open(args.json_report, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2, sort_keys=True, default=json_default)
            fh.write("\n")
        log(f"json_report={args.json_report}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
