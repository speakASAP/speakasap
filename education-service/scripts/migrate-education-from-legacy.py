#!/usr/bin/env python3
"""
ETL: speakasap-portal Postgres (legacy) -> speakasap_education_db (education-service Prisma tables).

Env (speakasap/.env at repo root):
  EDUCATION_SOURCE_DATABASE_URL — legacy Django DB (read-only recommended)
  EDUCATION_TARGET_DATABASE_URL — education-service DATABASE_URL (speakasap_education_db)
  Fallback: SOURCE_DATABASE_URL / TARGET_DATABASE_URL

Options:
  --dry-run          — row counts on source only; no writes
  --truncate-first   — delete target education tables (FK-safe order) before import
"""
from __future__ import annotations

import argparse
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


def dry_run_counts(src) -> None:
    tables = [
        "education_group",
        "education_group_students",
        "education_studentcourse",
        "education_lesson",
        "education_homework",
    ]
    cur = src.cursor()
    for t in tables:
        try:
            cur.execute('SELECT COUNT(*) FROM "{}"'.format(t))
            n = cur.fetchone()[0]
            log(f"dry-run count {t}={n}")
        except Exception as e:
            log(f"dry-run count {t} ERROR: {e}")
    cur.close()


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
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--truncate-first", action="store_true")
    args = parser.parse_args()

    src_u = source_url()
    tgt_u = target_url()
    if not src_u or not tgt_u:
        log("Missing EDUCATION_SOURCE_DATABASE_URL or EDUCATION_TARGET_DATABASE_URL (or SOURCE_/TARGET_)")
        return 1

    src = connect(src_u)
    try:
        if args.dry_run:
            dry_run_counts(src)
            return 0
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
