#!/usr/bin/env python3
"""
ETL: speakasap-portal Postgres (legacy) -> speakasap_education_db (education-service Prisma tables).

Env (speakasap/.env at repo root):
  EDUCATION_SOURCE_DATABASE_URL — legacy Django DB (read-only recommended)
  EDUCATION_TARGET_DATABASE_URL — education-service DATABASE_URL (speakasap_education_db)
  Fallback: SOURCE_DATABASE_URL / TARGET_DATABASE_URL

Options:
  --dry-run          — reconciliation report only; no writes
  --check-target     — include target counts/conflict samples in dry run
  --json-report      — print machine-readable dry-run report
  --truncate-first   — delete target education tables (FK-safe order) before import
  --allow-truncate-first — required together with --truncate-first outside dry run
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

try:
    import psycopg2
except ImportError:
    print("Install psycopg2-binary: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    print(f"{ts} {msg}", flush=True)


def connect(url: str):
    return psycopg2.connect(url, connect_timeout=30)


def source_url() -> str:
    return os.environ.get("EDUCATION_SOURCE_DATABASE_URL") or os.environ.get("SOURCE_DATABASE_URL", "")


def target_url() -> str:
    return os.environ.get("EDUCATION_TARGET_DATABASE_URL") or os.environ.get("TARGET_DATABASE_URL", "")


TABLES = [
    "education_group",
    "education_group_students",
    "education_studentcourse",
    "education_lesson",
    "education_homework",
]

TARGET_KEY_COLUMNS = {
    "education_group": "uuid",
    "education_group_students": "id",
    "education_studentcourse": "uuid",
    "education_lesson": "uuid",
    "education_homework": "uuid",
}

TARGET_PAIR_KEYS = {
    "education_group_students": ("group_id", "student_id"),
    "education_homework": ("lesson_id", "student_id"),
}


def json_safe(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value) if value is not None else None


def query_count(conn, sql: str, params=None) -> int:
    cur = conn.cursor()
    cur.execute(sql, params or [])
    value = int(cur.fetchone()[0])
    cur.close()
    return value


def sample_query(conn, sql: str, params=None, limit: int = 25) -> list[list[object]]:
    cur = conn.cursor()
    cur.execute(sql, list(params or []) + [limit])
    rows = cur.fetchall()
    cur.close()
    return [[json_safe(v) for v in row] for row in rows]


def table_counts(conn) -> dict[str, int | str]:
    counts: dict[str, int | str] = {}
    cur = conn.cursor()
    for t in TABLES:
        try:
            cur.execute('SELECT COUNT(*) FROM "{}"'.format(t))
            counts[t] = int(cur.fetchone()[0])
        except Exception as e:
            counts[t] = f"ERROR: {e}"
    cur.close()
    return counts


def count_and_sample(conn, count_sql: str, sample_sql: str, limit: int) -> dict[str, object]:
    return {
        "count": query_count(conn, count_sql),
        "sample": sample_query(conn, sample_sql, limit=limit),
    }


def duplicate_key_report(
    conn,
    table: str,
    columns: list[str],
    limit: int,
    where_sql: str = "",
) -> dict[str, object]:
    col_sql = ", ".join(qname(c) for c in columns)
    group_sql = ", ".join(qname(c) for c in columns)
    where_clause = f"WHERE {where_sql}" if where_sql else ""
    count_sql = f"""
        SELECT COUNT(*) FROM (
          SELECT {col_sql}
          FROM "{table}"
          {where_clause}
          GROUP BY {group_sql}
          HAVING COUNT(*) > 1
        ) dup
    """
    sample_sql = f"""
        SELECT {col_sql}, COUNT(*) AS duplicate_count
        FROM "{table}"
        {where_clause}
        GROUP BY {group_sql}
        HAVING COUNT(*) > 1
        ORDER BY duplicate_count DESC
        LIMIT %s
    """
    return count_and_sample(conn, count_sql, sample_sql, limit)


def source_reconciliation(src, limit: int) -> dict[str, object]:
    return {
        "source_counts": table_counts(src),
        "duplicate_keys": {
            "education_group.uuid": duplicate_key_report(src, "education_group", ["uuid"], limit),
            "education_group_students.id": duplicate_key_report(src, "education_group_students", ["id"], limit),
            "education_group_students.group_student": duplicate_key_report(
                src,
                "education_group_students",
                ["group_id", "student_id"],
                limit,
            ),
            "education_studentcourse.uuid": duplicate_key_report(src, "education_studentcourse", ["uuid"], limit),
            "education_studentcourse.previous_id": duplicate_key_report(
                src,
                "education_studentcourse",
                ["previous_id"],
                limit,
                '"previous_id" IS NOT NULL',
            ),
            "education_lesson.uuid": duplicate_key_report(src, "education_lesson", ["uuid"], limit),
            "education_homework.uuid": duplicate_key_report(src, "education_homework", ["uuid"], limit),
            "education_homework.lesson_student": duplicate_key_report(
                src,
                "education_homework",
                ["lesson_id", "student_id"],
                limit,
            ),
        },
        "missing_references": {
            "group_students_missing_group": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "education_group_students" gs
                LEFT JOIN "education_group" g ON g."uuid" = gs."group_id"
                WHERE g."uuid" IS NULL
                """,
                """
                SELECT gs."id", gs."group_id", gs."student_id"
                FROM "education_group_students" gs
                LEFT JOIN "education_group" g ON g."uuid" = gs."group_id"
                WHERE g."uuid" IS NULL
                ORDER BY gs."id"
                LIMIT %s
                """,
                limit,
            ),
            "student_courses_missing_group": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "education_studentcourse" sc
                LEFT JOIN "education_group" g ON g."uuid" = sc."group_id"
                WHERE g."uuid" IS NULL
                """,
                """
                SELECT sc."uuid", sc."group_id"
                FROM "education_studentcourse" sc
                LEFT JOIN "education_group" g ON g."uuid" = sc."group_id"
                WHERE g."uuid" IS NULL
                ORDER BY sc."uuid"
                LIMIT %s
                """,
                limit,
            ),
            "student_courses_missing_previous": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "education_studentcourse" sc
                LEFT JOIN "education_studentcourse" prev ON prev."uuid" = sc."previous_id"
                WHERE sc."previous_id" IS NOT NULL AND prev."uuid" IS NULL
                """,
                """
                SELECT sc."uuid", sc."previous_id"
                FROM "education_studentcourse" sc
                LEFT JOIN "education_studentcourse" prev ON prev."uuid" = sc."previous_id"
                WHERE sc."previous_id" IS NOT NULL AND prev."uuid" IS NULL
                ORDER BY sc."uuid"
                LIMIT %s
                """,
                limit,
            ),
            "lessons_missing_student_course": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "education_lesson" l
                LEFT JOIN "education_studentcourse" sc ON sc."uuid" = l."student_course_id"
                WHERE sc."uuid" IS NULL
                """,
                """
                SELECT l."uuid", l."student_course_id", l."teacher_id"
                FROM "education_lesson" l
                LEFT JOIN "education_studentcourse" sc ON sc."uuid" = l."student_course_id"
                WHERE sc."uuid" IS NULL
                ORDER BY l."uuid"
                LIMIT %s
                """,
                limit,
            ),
            "homework_missing_lesson": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "education_homework" h
                LEFT JOIN "education_lesson" l ON l."uuid" = h."lesson_id"
                WHERE l."uuid" IS NULL
                """,
                """
                SELECT h."uuid", h."lesson_id", h."student_id"
                FROM "education_homework" h
                LEFT JOIN "education_lesson" l ON l."uuid" = h."lesson_id"
                WHERE l."uuid" IS NULL
                ORDER BY h."uuid"
                LIMIT %s
                """,
                limit,
            ),
        },
    }


def fetch_key_values(conn, table: str, column: str) -> list[str]:
    cur = conn.cursor()
    cur.execute(f'SELECT {qname(column)}::text FROM "{table}"')
    values = [str(row[0]) for row in cur.fetchall() if row[0] is not None]
    cur.close()
    return values


def fetch_pair_values(conn, table: str, columns: tuple[str, str]) -> set[tuple[str, str]]:
    cur = conn.cursor()
    cur.execute(f'SELECT {qname(columns[0])}::text, {qname(columns[1])}::text FROM "{table}"')
    pairs = {(str(row[0]), str(row[1])) for row in cur.fetchall() if row[0] is not None and row[1] is not None}
    cur.close()
    return pairs


def target_key_conflict_count(tgt, table: str, column: str, source_values: list[str], limit: int) -> dict[str, object]:
    if not source_values:
        return {"count": 0, "sample": []}
    found: list[str] = []
    cur = tgt.cursor()
    for i in range(0, len(source_values), 1000):
        chunk = source_values[i : i + 1000]
        cur.execute(
            f'SELECT {qname(column)}::text FROM "{table}" WHERE {qname(column)}::text = ANY(%s)',
            [chunk],
        )
        found.extend(str(row[0]) for row in cur.fetchall())
    cur.close()
    found_sorted = sorted(set(found))
    return {"count": len(found_sorted), "sample": found_sorted[:limit]}


def target_pair_conflict_count(
    src,
    tgt,
    table: str,
    columns: tuple[str, str],
    limit: int,
) -> dict[str, object]:
    source_pairs = fetch_pair_values(src, table, columns)
    target_pairs = fetch_pair_values(tgt, table, columns)
    conflicts = sorted(source_pairs.intersection(target_pairs))
    return {"count": len(conflicts), "sample": [list(pair) for pair in conflicts[:limit]]}


def target_reconciliation(src, tgt, limit: int) -> dict[str, object]:
    key_conflicts: dict[str, object] = {}
    for table, column in TARGET_KEY_COLUMNS.items():
        key_conflicts[f"{table}.{column}"] = target_key_conflict_count(
            tgt,
            table,
            column,
            fetch_key_values(src, table, column),
            limit,
        )

    pair_conflicts: dict[str, object] = {}
    for table, columns in TARGET_PAIR_KEYS.items():
        pair_conflicts[f"{table}.{columns[0]}_{columns[1]}"] = target_pair_conflict_count(
            src,
            tgt,
            table,
            columns,
            limit,
        )

    return {
        "target_counts": table_counts(tgt),
        "target_key_conflicts": key_conflicts,
        "target_pair_conflicts": pair_conflicts,
    }


def dry_run_report(src, tgt=None, check_target: bool = False, limit: int = 25) -> dict[str, object]:
    report = {
        "dry_run": True,
        "writes": False,
        "source": source_reconciliation(src, limit),
    }
    if check_target:
        if tgt is None:
            report["target"] = {"available": False, "reason": "target URL not configured"}
        else:
            target = target_reconciliation(src, tgt, limit)
            target["available"] = True
            report["target"] = target
    return report


def emit_report(report: dict[str, object], json_report: bool) -> None:
    if json_report:
        print(json.dumps(report, indent=2, sort_keys=True), flush=True)
        return
    source = report["source"]
    for table, count in source["source_counts"].items():
        log(f"dry-run source_count {table}={count}")
    for group, items in (
        ("duplicate", source["duplicate_keys"]),
        ("missing_reference", source["missing_references"]),
    ):
        for name, result in items.items():
            log(f"dry-run {group} {name} count={result['count']} sample={result['sample']}")
    target = report.get("target")
    if target:
        if not target.get("available"):
            log(f"dry-run target skipped reason={target.get('reason')}")
            return
        for table, count in target["target_counts"].items():
            log(f"dry-run target_count {table}={count}")
        for name, result in target["target_key_conflicts"].items():
            log(f"dry-run target_key_conflict {name} count={result['count']} sample={result['sample']}")
        for name, result in target["target_pair_conflicts"].items():
            log(f"dry-run target_pair_conflict {name} count={result['count']} sample={result['sample']}")


def truncate_target(tgt) -> None:
    cur = tgt.cursor()
    stmts = [
        'DELETE FROM "education_homework"',
        'DELETE FROM "education_lesson"',
        'DELETE FROM "education_studentcourse"',
        'DELETE FROM "education_group_students"',
        'DELETE FROM "education_group"',
    ]
    for s in stmts:
        log(f"truncate step: {s}")
        cur.execute(s)
    tgt.commit()
    cur.close()


def qname(name: str) -> str:
    return '"' + name.replace('"', "") + '"'


def copy_table(src, tgt, table: str, columns: list[str]) -> int:
    col_sql = ", ".join(qname(c) for c in columns)
    sel = ", ".join(qname(c) for c in columns)
    sc = src.cursor()
    tc = tgt.cursor()
    sc.execute(f'SELECT {sel} FROM "{table}"')
    rows = sc.fetchall()
    n = 0
    for row in rows:
        placeholders = ", ".join(["%s"] * len(columns))
        tc.execute(
            f'INSERT INTO "{table}" ({col_sql}) VALUES ({placeholders})',
            row,
        )
        n += 1
    tgt.commit()
    sc.close()
    tc.close()
    log(f"copied {table} rows_written={n}")
    return n


def copy_student_courses_two_phase(src, tgt) -> None:
    cols = [
        "uuid",
        "course_class",
        "course_display_title",
        "created",
        "open_strategy_class",
        "group_id",
        "is_finished",
        "end_date",
        "is_new",
        "is_paused",
        "auto_pause",
        "pause_date",
    ]
    sel = ", ".join(qname(c) for c in cols + ["previous_id"])
    sc = src.cursor()
    tc = tgt.cursor()
    sc.execute(
        f"""
        SELECT {sel}
        FROM "education_studentcourse"
        """
    )
    rows = sc.fetchall()
    n = 0
    for row in rows:
        data = row[:-1]
        placeholders = ", ".join(["%s"] * (len(cols) + 1))
        col_sql = ", ".join(qname(c) for c in cols + ["previous_id"])
        tc.execute(
            f'INSERT INTO "education_studentcourse" ({col_sql}) VALUES ({placeholders})',
            list(data) + [None],
        )
        n += 1
    tgt.commit()
    log(f"copied education_studentcourse phase1 rows={n} (previous_id deferred)")
    sc.execute(
        'SELECT "uuid", "previous_id" FROM "education_studentcourse" WHERE "previous_id" IS NOT NULL'
    )
    patches = sc.fetchall()
    p = 0
    for uuid, previous_id in patches:
        tc.execute(
            'UPDATE "education_studentcourse" SET previous_id = %s WHERE uuid = %s',
            [previous_id, uuid],
        )
        p += 1
    tgt.commit()
    sc.close()
    tc.close()
    log(f"patched education_studentcourse previous_id rows={p}")


def migrate(src, tgt, truncate: bool) -> None:
    if truncate:
        truncate_target(tgt)
    copy_table(src, tgt, "education_group", ["uuid", "title", "created"])
    copy_table(src, tgt, "education_group_students", ["id", "group_id", "student_id"])
    copy_student_courses_two_phase(src, tgt)
    copy_table(
        src,
        tgt,
        "education_lesson",
        [
            "uuid",
            "order",
            "teacher_id",
            "start",
            "lesson_change_start_count",
            "is_finished",
            "student_course_id",
            "module_class",
            "needs_teacher",
            "assign_teacher_automatically",
            "recommendation",
            "to_manager",
        ],
    )
    copy_table(
        src,
        tgt,
        "education_homework",
        [
            "uuid",
            "lesson_id",
            "student_id",
            "content_student",
            "content_teacher",
            "ready",
            "comment",
            "checked",
        ],
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="produce reconciliation report without writes")
    parser.add_argument("--check-target", action="store_true", help="include target counts and key conflicts in dry-run")
    parser.add_argument("--json-report", action="store_true", help="print dry-run report as JSON")
    parser.add_argument("--limit", type=int, default=25, help="maximum sample rows per reconciliation bucket")
    parser.add_argument("--truncate-first", action="store_true", help="delete target education tables before import")
    parser.add_argument(
        "--allow-truncate-first",
        action="store_true",
        help="required with --truncate-first outside dry-run",
    )
    args = parser.parse_args()

    src_u = source_url()
    tgt_u = target_url()
    if not src_u:
        log("Missing EDUCATION_SOURCE_DATABASE_URL or SOURCE_DATABASE_URL")
        return 1
    if not args.dry_run and args.truncate_first and not args.allow_truncate_first:
        log("Refusing --truncate-first without --allow-truncate-first")
        return 2

    src = connect(src_u)
    try:
        if args.dry_run:
            tgt = None
            if args.check_target and tgt_u:
                tgt = connect(tgt_u)
            try:
                report = dry_run_report(
                    src,
                    tgt=tgt,
                    check_target=args.check_target,
                    limit=max(args.limit, 1),
                )
                emit_report(report, args.json_report)
            finally:
                if tgt is not None:
                    tgt.close()
            return 0
        if not tgt_u:
            log("Missing EDUCATION_TARGET_DATABASE_URL or TARGET_DATABASE_URL")
            return 1
        tgt = connect(tgt_u)
        try:
            migrate(src, tgt, args.truncate_first)
        finally:
            tgt.close()
    finally:
        src.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
