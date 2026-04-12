#!/usr/bin/env python3
"""
ETL: speakasap-portal Postgres (legacy) -> speakasap_course_db (course-service Prisma tables).

Env (speakasap/.env at repo root):
  COURSE_SOURCE_DATABASE_URL — legacy Django DB (read-only recommended)
  COURSE_TARGET_DATABASE_URL — course-service DATABASE_URL (speakasap_course_db)
  Fallback: SOURCE_DATABASE_URL / TARGET_DATABASE_URL

Options:
  --dry-run          — row counts on source only; no writes
  --truncate-first   — delete target course tables (FK-safe order) before import
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
    return os.environ.get("COURSE_SOURCE_DATABASE_URL") or os.environ.get("SOURCE_DATABASE_URL", "")


def target_url() -> str:
    return os.environ.get("COURSE_TARGET_DATABASE_URL") or os.environ.get("TARGET_DATABASE_URL", "")


def dry_run_counts(src) -> None:
    tables = [
        "products_category",
        "products_partpaymentcollection",
        "products_partpaymentoption",
        "products_product",
        "products_product_part_payments",
        "offers_extralessonsoffer",
        "offers_offer",
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
        'DELETE FROM "offers_offer"',
        'DELETE FROM "offers_extralessonsoffer"',
        'DELETE FROM "products_product_part_payments"',
        'DELETE FROM "products_partpaymentoption"',
        'DELETE FROM "products_product"',
        'DELETE FROM "products_partpaymentcollection"',
        'DELETE FROM "products_category"',
    ]
    for s in stmts:
        log(f"truncate step: {s}")
        cur.execute(s)
    tgt.commit()
    cur.close()


def copy_table(src, tgt, table: str, columns: list[str]) -> int:
    col_sql = ", ".join(f'"{c}"' for c in columns)
    sel = ", ".join(columns)
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


def migrate(src, tgt, truncate: bool) -> None:
    if truncate:
        truncate_target(tgt)
    # Order respects FKs on target
    copy_table(
        src,
        tgt,
        "products_category",
        ["id", "title", "product_for_offers"],
    )
    copy_table(
        src,
        tgt,
        "products_partpaymentcollection",
        ["id", "title", "comment"],
    )
    copy_table(
        src,
        tgt,
        "products_partpaymentoption",
        ["id", "part_id", "price", "day", "open_steps"],
    )
    copy_table(
        src,
        tgt,
        "products_product",
        [
            "id",
            "title",
            "en_title",
            "price",
            "tags",
            "language_id",
            "category_id",
            "label",
            "android_id",
            "material_language",
            "trashed",
        ],
    )
    copy_table(
        src,
        tgt,
        "products_product_part_payments",
        ["product_id", "partpaymentcollection_id"],
    )
    copy_table(
        src,
        tgt,
        "offers_extralessonsoffer",
        [
            "id",
            "product_id",
            "teacher_id",
            "lessons",
            "teacher_native_id",
            "lessons_native",
            "comment",
        ],
    )
    copy_table(
        src,
        tgt,
        "offers_offer",
        [
            "uuid",
            "student_id",
            "teacher_id",
            "offerer_id",
            "course_product_id",
            "extra_lessons_id",
            "order_id",
            "created",
            "opened",
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
        log("Missing COURSE_SOURCE_DATABASE_URL or COURSE_TARGET_DATABASE_URL (or SOURCE_/TARGET_)")
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
