#!/usr/bin/env python3
"""
ETL: speakasap-portal lesson recording metadata -> education-service.

This migration imports metadata and private object-key references only. It never
reads, writes, deletes, or publishes MinIO/S3 objects.

Env:
  EDUCATION_SOURCE_DATABASE_URL or SOURCE_DATABASE_URL
  EDUCATION_TARGET_DATABASE_URL or TARGET_DATABASE_URL

Modes:
  --dry-run          Reconciliation report only; no writes
  --apply            Write-gated upsert; requires --confirm-write,
                     --approval-note, and --rollback-plan
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

psycopg2 = None


OLD_PREFIX = "courses/records/"
MODERN_KEY_RE = re.compile(r"^\d{4}/\d{2}/\d{2}/.+$")
BLOCKING_ISSUES = {
    "bad_parts_json",
    "missing_source_lesson",
    "missing_target_lessons",
    "duplicate_lesson_records",
    "part_referenced_by_multiple_records",
    "target_lesson_record_uuid_conflicts",
    "target_lesson_record_lesson_conflicts",
    "target_lesson_record_part_uuid_conflicts",
}


def log(message: str) -> None:
    print(f"{datetime.now(timezone.utc).isoformat()} {message}", flush=True)


def source_url() -> str:
    return os.environ.get("EDUCATION_SOURCE_DATABASE_URL") or os.environ.get("SOURCE_DATABASE_URL", "")


def target_url() -> str:
    return os.environ.get("EDUCATION_TARGET_DATABASE_URL") or os.environ.get("TARGET_DATABASE_URL", "")


def connect(url: str):
    ensure_psycopg2()
    return psycopg2.connect(url, connect_timeout=30)


def ensure_psycopg2() -> None:
    global psycopg2
    if psycopg2 is not None:
        return
    try:
        import psycopg2 as loaded_psycopg2
        import psycopg2.extras  # noqa: F401
    except ImportError:
        print("Install psycopg2-binary: pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)
    psycopg2 = loaded_psycopg2


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


def sample(values: list[Any], limit: int) -> list[Any]:
    if limit <= 0:
        return values
    return values[:limit]


def fetch_source_records(src, source_limit: int) -> list[dict[str, Any]]:
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
    params: tuple[Any, ...] = ()
    if source_limit > 0:
        sql += " LIMIT %s"
        params = (source_limit,)
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


def table_exists(tgt, table_name: str) -> bool:
    cur = tgt.cursor()
    cur.execute("SELECT to_regclass(%s)", (table_name,))
    exists = cur.fetchone()[0] is not None
    cur.close()
    return exists


def fetch_target_lessons(tgt, lesson_ids: set[str]) -> set[str]:
    if not lesson_ids:
        return set()
    found: set[str] = set()
    cur = tgt.cursor()
    ids = sorted(lesson_ids)
    for idx in range(0, len(ids), 1000):
        chunk = ids[idx:idx + 1000]
        cur.execute('SELECT "uuid"::text FROM "education_lesson" WHERE "uuid"::text = ANY(%s)', (chunk,))
        found.update(row[0] for row in cur.fetchall())
    cur.close()
    return found


def fetch_target_records(tgt, record_ids: set[str], lesson_ids: set[str]) -> tuple[dict[str, str], dict[str, str]]:
    if not table_exists(tgt, "education_lessonrecord"):
        return {}, {}
    by_uuid: dict[str, str] = {}
    by_lesson: dict[str, str] = {}
    cur = tgt.cursor()
    ids = sorted(record_ids)
    for idx in range(0, len(ids), 1000):
        chunk = ids[idx:idx + 1000]
        cur.execute('SELECT "uuid"::text, "lesson_id"::text FROM "education_lessonrecord" WHERE "uuid"::text = ANY(%s)', (chunk,))
        by_uuid.update({uuid: lesson_id for uuid, lesson_id in cur.fetchall()})
    lessons = sorted(lesson_ids)
    for idx in range(0, len(lessons), 1000):
        chunk = lessons[idx:idx + 1000]
        cur.execute('SELECT "lesson_id"::text, "uuid"::text FROM "education_lessonrecord" WHERE "lesson_id"::text = ANY(%s)', (chunk,))
        by_lesson.update({lesson_id: uuid for lesson_id, uuid in cur.fetchall()})
    cur.close()
    return by_uuid, by_lesson


def fetch_target_parts(tgt, part_ids: set[str]) -> dict[str, str]:
    if not table_exists(tgt, "education_lessonrecordpart") or not part_ids:
        return {}
    found: dict[str, str] = {}
    cur = tgt.cursor()
    ids = sorted(part_ids)
    for idx in range(0, len(ids), 1000):
        chunk = ids[idx:idx + 1000]
        cur.execute(
            'SELECT "uuid"::text, "lesson_record_id"::text FROM "education_lessonrecordpart" WHERE "uuid"::text = ANY(%s)',
            (chunk,),
        )
        found.update({uuid: lesson_record_id for uuid, lesson_record_id in cur.fetchall()})
    cur.close()
    return found


def build_plan(src, tgt, args) -> tuple[dict[str, Any], list[tuple[Any, ...]], list[tuple[Any, ...]]]:
    records = fetch_source_records(src, args.source_limit)
    parts_by_uuid = fetch_source_parts(src)
    lesson_ids = {r["lesson_id"] for r in records if r.get("lesson_id")}
    target_lessons = fetch_target_lessons(tgt, lesson_ids) if tgt else set()
    target_records_by_uuid, target_records_by_lesson = fetch_target_records(
        tgt,
        {r["uuid"] for r in records},
        lesson_ids,
    ) if tgt else ({}, {})

    counts: Counter[str] = Counter()
    issues: dict[str, list[Any]] = defaultdict(list)
    part_to_record: dict[str, list[str]] = defaultdict(list)
    referenced_parts: set[str] = set()
    lesson_record_seen: Counter[str] = Counter()
    record_rows: list[tuple[Any, ...]] = []
    part_rows: list[tuple[Any, ...]] = []

    counts["source_lesson_records"] = len(records)
    counts["source_lesson_record_parts"] = len(parts_by_uuid)
    counts["target_lesson_records_existing"] = len(target_records_by_uuid)

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
        record_rows.append((
            record_uuid,
            lesson_id,
            record_key or None,
            processed,
            unavailable,
            json.dumps(parts),
            row.get("created"),
        ))

        if parts_warning:
            issues["bad_parts_json"].append({"lessonRecordUuid": record_uuid, "warning": parts_warning})
        if not row.get("lesson_uuid"):
            issues["missing_source_lesson"].append({"lessonRecordUuid": record_uuid, "lessonId": lesson_id})
        if tgt and lesson_id not in target_lessons:
            issues["missing_target_lessons"].append({"lessonRecordUuid": record_uuid, "lessonId": lesson_id})

        target_lesson_for_uuid = target_records_by_uuid.get(record_uuid)
        if target_lesson_for_uuid and target_lesson_for_uuid != lesson_id:
            issues["target_lesson_record_uuid_conflicts"].append({
                "lessonRecordUuid": record_uuid,
                "sourceLessonId": lesson_id,
                "targetLessonId": target_lesson_for_uuid,
            })
        target_uuid_for_lesson = target_records_by_lesson.get(lesson_id)
        if target_uuid_for_lesson and target_uuid_for_lesson != record_uuid:
            issues["target_lesson_record_lesson_conflicts"].append({
                "lessonId": lesson_id,
                "sourceLessonRecordUuid": record_uuid,
                "targetLessonRecordUuid": target_uuid_for_lesson,
            })

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
                part_rows.append((part_uuid, record_uuid, parts_by_uuid[part_uuid], row.get("created")))

    target_parts = fetch_target_parts(tgt, {p[0] for p in part_rows}) if tgt else {}
    for part_uuid, record_uuid, _part_key, _created in part_rows:
        target_record_uuid = target_parts.get(part_uuid)
        if target_record_uuid and target_record_uuid != record_uuid:
            issues["target_lesson_record_part_uuid_conflicts"].append({
                "partUuid": part_uuid,
                "sourceLessonRecordUuid": record_uuid,
                "targetLessonRecordUuid": target_record_uuid,
            })

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
    counts["would_upsert_lesson_records"] = len(record_rows)
    counts["would_upsert_lesson_record_parts"] = len(part_rows)
    counts["records_inconsistent"] += (
        len(issues["bad_parts_json"])
        + len(issues["missing_source_lesson"])
        + len(issues["missing_target_lessons"])
        + len(issues["parts_missing_rows"])
        + len(issues["duplicate_lesson_records"])
        + len(issues["part_referenced_by_multiple_records"])
    )

    issue_counts = {key: len(values) for key, values in sorted(issues.items())}
    blocking_issue_counts = {key: issue_counts.get(key, 0) for key in sorted(BLOCKING_ISSUES) if issue_counts.get(key, 0)}
    mode = "apply-plan" if args.apply else "dry-run"
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "writes": False,
        "sampleLimit": args.limit or None,
        "sourceLimit": args.source_limit or None,
        "checkTarget": tgt is not None,
        "counts": dict(sorted(counts.items())),
        "issues": {key: sample(values, args.limit) for key, values in sorted(issues.items())},
        "issueCounts": issue_counts,
        "blockingIssueCounts": blocking_issue_counts,
        "wouldUpsertLessonRecords": sample(sorted({r[0] for r in record_rows}), args.limit),
        "wouldUpsertLessonRecordParts": sample(sorted({p[0] for p in part_rows}), args.limit),
        "notes": [
            "Metadata/key-reference migration only; object storage was not modified.",
            "Key mismatch and old-prefix issues are preserved as source evidence and do not rewrite keys.",
            "Orphan part rows are not imported because the target part table is attached to a lesson record.",
        ],
    }
    return report, record_rows, part_rows


def ensure_no_blocking_issues(report: dict[str, Any]) -> None:
    blocking = report.get("blockingIssueCounts") or {}
    if blocking:
        raise RuntimeError(f"Refusing apply because blocking reconciliation issues remain: {blocking}")


def sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def write_rollback(path: str, record_rows: list[tuple[Any, ...]], part_rows: list[tuple[Any, ...]], approval_note: str) -> None:
    record_ids = sorted({str(row[0]) for row in record_rows})
    part_ids = sorted({str(row[0]) for row in part_rows})
    lines = [
        "-- Rollback for SpeakASAP lesson-record metadata migration.",
        f"-- Generated at {datetime.now(timezone.utc).isoformat()}",
        f"-- Approval note: {approval_note}",
        "-- Object storage is not modified by rollback.",
        "BEGIN;",
    ]
    if part_ids:
        lines.append(
            'DELETE FROM "education_lessonrecordpart" WHERE "uuid" = ANY(ARRAY['
            + ",".join(sql_string(v) for v in part_ids)
            + "]::uuid[]);"
        )
    if record_ids:
        lines.append(
            'DELETE FROM "education_lessonrecord" WHERE "uuid" = ANY(ARRAY['
            + ",".join(sql_string(v) for v in record_ids)
            + "]::uuid[]);"
        )
    lines.append("COMMIT;")
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")


def apply_rows(tgt, record_rows: list[tuple[Any, ...]], part_rows: list[tuple[Any, ...]]) -> dict[str, int]:
    with tgt:
        with tgt.cursor() as cur:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO "education_lessonrecord"
                  ("uuid", "lesson_id", "record", "processed", "record_unavailable", "parts", "created", "updated")
                VALUES %s
                ON CONFLICT ("uuid") DO UPDATE SET
                  "lesson_id" = EXCLUDED."lesson_id",
                  "record" = EXCLUDED."record",
                  "processed" = EXCLUDED."processed",
                  "record_unavailable" = EXCLUDED."record_unavailable",
                  "parts" = EXCLUDED."parts",
                  "created" = EXCLUDED."created",
                  "updated" = CURRENT_TIMESTAMP
                """,
                record_rows,
                template="(%s::uuid, %s::uuid, %s, %s, %s, %s::jsonb, %s, CURRENT_TIMESTAMP)",
                page_size=1000,
            )
            if part_rows:
                psycopg2.extras.execute_values(
                    cur,
                    """
                    INSERT INTO "education_lessonrecordpart"
                      ("uuid", "lesson_record_id", "part_file", "created")
                    VALUES %s
                    ON CONFLICT ("uuid") DO UPDATE SET
                      "lesson_record_id" = EXCLUDED."lesson_record_id",
                      "part_file" = EXCLUDED."part_file",
                      "created" = EXCLUDED."created"
                    """,
                    part_rows,
                    template="(%s::uuid, %s::uuid, %s, %s)",
                    page_size=1000,
                )
    return {
        "upsertedLessonRecords": len(record_rows),
        "upsertedLessonRecordParts": len(part_rows),
    }


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
        "would_upsert_lesson_records",
        "would_upsert_lesson_record_parts",
    ]
    for key in ordered_keys:
        log(f"{key}={counts.get(key, 0)}")
    for key, count in report.get("issueCounts", {}).items():
        log(f"issue {key}={count}")
    if report.get("blockingIssueCounts"):
        log(f"blocking_issues={report['blockingIssueCounts']}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Read-only reconciliation mode.")
    mode.add_argument("--apply", action="store_true", help="Write-gated upsert mode.")
    parser.add_argument("--check-target", action="store_true", help="Verify source lesson IDs exist in target education_lesson.")
    parser.add_argument("--limit", type=int, default=25, help="Limit sample arrays in the report; counts inspect all selected source records.")
    parser.add_argument("--source-limit", type=int, default=0, help="Debug-only cap for source lesson records. Do not use for migration evidence.")
    parser.add_argument("--json-report", default="", help="Write JSON report to this path.")
    parser.add_argument("--confirm-write", action="store_true", help="Required with --apply.")
    parser.add_argument("--approval-note", default="", help="Owner approval evidence; required with --apply.")
    parser.add_argument("--rollback-plan", default="", help="Path for rollback SQL generated before --apply writes.")
    return parser.parse_args()


def validate_mode(args: argparse.Namespace) -> int:
    if args.apply:
        missing = []
        if not args.confirm_write:
            missing.append("--confirm-write")
        if not args.approval_note.strip():
            missing.append("--approval-note")
        if not args.rollback_plan.strip():
            missing.append("--rollback-plan")
        if missing:
            log("Refusing apply; missing " + ", ".join(missing))
            return 2
    elif args.confirm_write or args.approval_note or args.rollback_plan:
        log("Write-gate flags are only valid with --apply.")
        return 2
    return 0


def main() -> int:
    args = parse_args()
    mode_error = validate_mode(args)
    if mode_error:
        return mode_error

    src_u = source_url()
    if not src_u:
        log("Missing EDUCATION_SOURCE_DATABASE_URL or SOURCE_DATABASE_URL")
        return 1

    tgt_u = target_url()
    if (args.check_target or args.apply) and not tgt_u:
        log("Missing EDUCATION_TARGET_DATABASE_URL or TARGET_DATABASE_URL")
        return 1

    src = connect(src_u)
    tgt = None
    try:
        if args.check_target or args.apply:
            tgt = connect(tgt_u)
        if args.apply and (
            not table_exists(tgt, "education_lessonrecord")
            or not table_exists(tgt, "education_lessonrecordpart")
        ):
            log("Refusing apply; target lesson-record tables are missing. Run education-service Prisma migrations first.")
            return 2
        report, record_rows, part_rows = build_plan(src, tgt, args)
        if args.apply:
            ensure_no_blocking_issues(report)
            write_rollback(args.rollback_plan, record_rows, part_rows, args.approval_note)
            log(f"rollback_plan={args.rollback_plan}")
            apply_summary = apply_rows(tgt, record_rows, part_rows)
            report["mode"] = "apply"
            report["writes"] = True
            report["applySummary"] = apply_summary
            report["approvalNote"] = args.approval_note
            report["rollbackPlan"] = args.rollback_plan
    except RuntimeError as exc:
        log(str(exc))
        return 2
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
