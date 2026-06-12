#!/usr/bin/env python3
"""
ETL: speakasap-portal Postgres (legacy) -> speakasap_course_db (course-service Prisma tables).

Env (speakasap/.env at repo root):
  COURSE_SOURCE_DATABASE_URL — legacy Django DB (read-only recommended)
  COURSE_TARGET_DATABASE_URL — course-service DATABASE_URL (speakasap_course_db)
  Fallback: SOURCE_DATABASE_URL / TARGET_DATABASE_URL

Options:
  --dry-run          — reconciliation report only; no writes
  --check-target     — include target counts/conflict samples in dry run
  --json-report      — print machine-readable dry-run report
  --limit            — maximum sample rows per reconciliation bucket
  --truncate-first   — delete target course tables (FK-safe order) before import
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
    return os.environ.get("COURSE_SOURCE_DATABASE_URL") or os.environ.get("SOURCE_DATABASE_URL", "")


def target_url() -> str:
    return os.environ.get("COURSE_TARGET_DATABASE_URL") or os.environ.get("TARGET_DATABASE_URL", "")


TABLES = [
    "products_category",
    "products_partpaymentcollection",
    "products_partpaymentoption",
    "products_product",
    "products_product_part_payments",
    "offers_extralessonsoffer",
    "offers_offer",
]

TARGET_KEY_COLUMNS = {
    "products_category": "id",
    "products_partpaymentcollection": "id",
    "products_partpaymentoption": "id",
    "products_product": "id",
    "offers_extralessonsoffer": "id",
    "offers_offer": "uuid",
}

TARGET_PAIR_KEYS = {
    "products_product_part_payments": ("product_id", "partpaymentcollection_id"),
}


def json_safe(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value) if value is not None else None


def qname(name: str) -> str:
    return '"' + name.replace('"', "") + '"'


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
    for table in TABLES:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            counts[table] = int(cur.fetchone()[0])
        except Exception as e:
            counts[table] = f"ERROR: {e}"
    cur.close()
    return counts


def count_and_sample(conn, count_sql: str, sample_sql: str, limit: int, params=None) -> dict[str, object]:
    return {
        "count": query_count(conn, count_sql, params),
        "sample": sample_query(conn, sample_sql, params, limit=limit),
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
            "products_category.id": duplicate_key_report(src, "products_category", ["id"], limit),
            "products_partpaymentcollection.id": duplicate_key_report(
                src,
                "products_partpaymentcollection",
                ["id"],
                limit,
            ),
            "products_partpaymentoption.id": duplicate_key_report(src, "products_partpaymentoption", ["id"], limit),
            "products_product.id": duplicate_key_report(src, "products_product", ["id"], limit),
            "products_product_part_payments.pair": duplicate_key_report(
                src,
                "products_product_part_payments",
                ["product_id", "partpaymentcollection_id"],
                limit,
            ),
            "offers_extralessonsoffer.id": duplicate_key_report(src, "offers_extralessonsoffer", ["id"], limit),
            "offers_offer.uuid": duplicate_key_report(src, "offers_offer", ["uuid"], limit),
            "offers_offer.extra_lessons_id": duplicate_key_report(
                src,
                "offers_offer",
                ["extra_lessons_id"],
                limit,
                '"extra_lessons_id" IS NOT NULL',
            ),
        },
        "missing_references": {
            "partpaymentoption_missing_collection": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "products_partpaymentoption" p
                LEFT JOIN "products_partpaymentcollection" c ON c."id" = p."part_id"
                WHERE c."id" IS NULL
                """,
                """
                SELECT p."id", p."part_id"
                FROM "products_partpaymentoption" p
                LEFT JOIN "products_partpaymentcollection" c ON c."id" = p."part_id"
                WHERE c."id" IS NULL
                ORDER BY p."id"
                LIMIT %s
                """,
                limit,
            ),
            "product_missing_category": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "products_product" p
                LEFT JOIN "products_category" c ON c."id" = p."category_id"
                WHERE c."id" IS NULL
                """,
                """
                SELECT p."id", p."category_id"
                FROM "products_product" p
                LEFT JOIN "products_category" c ON c."id" = p."category_id"
                WHERE c."id" IS NULL
                ORDER BY p."id"
                LIMIT %s
                """,
                limit,
            ),
            "product_part_payments_missing_product": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "products_product_part_payments" rel
                LEFT JOIN "products_product" p ON p."id" = rel."product_id"
                WHERE p."id" IS NULL
                """,
                """
                SELECT rel."product_id", rel."partpaymentcollection_id"
                FROM "products_product_part_payments" rel
                LEFT JOIN "products_product" p ON p."id" = rel."product_id"
                WHERE p."id" IS NULL
                ORDER BY rel."product_id", rel."partpaymentcollection_id"
                LIMIT %s
                """,
                limit,
            ),
            "product_part_payments_missing_collection": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "products_product_part_payments" rel
                LEFT JOIN "products_partpaymentcollection" c ON c."id" = rel."partpaymentcollection_id"
                WHERE c."id" IS NULL
                """,
                """
                SELECT rel."product_id", rel."partpaymentcollection_id"
                FROM "products_product_part_payments" rel
                LEFT JOIN "products_partpaymentcollection" c ON c."id" = rel."partpaymentcollection_id"
                WHERE c."id" IS NULL
                ORDER BY rel."product_id", rel."partpaymentcollection_id"
                LIMIT %s
                """,
                limit,
            ),
            "extra_lessons_missing_product": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "offers_extralessonsoffer" e
                LEFT JOIN "products_product" p ON p."id" = e."product_id"
                WHERE p."id" IS NULL
                """,
                """
                SELECT e."id", e."product_id"
                FROM "offers_extralessonsoffer" e
                LEFT JOIN "products_product" p ON p."id" = e."product_id"
                WHERE p."id" IS NULL
                ORDER BY e."id"
                LIMIT %s
                """,
                limit,
            ),
            "extra_lessons_missing_teacher": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "offers_extralessonsoffer" e
                LEFT JOIN "employees_teacher" t ON t."id" = e."teacher_id"
                WHERE e."teacher_id" IS NOT NULL AND t."id" IS NULL
                """,
                """
                SELECT e."id", e."teacher_id"
                FROM "offers_extralessonsoffer" e
                LEFT JOIN "employees_teacher" t ON t."id" = e."teacher_id"
                WHERE e."teacher_id" IS NOT NULL AND t."id" IS NULL
                ORDER BY e."id"
                LIMIT %s
                """,
                limit,
            ),
            "extra_lessons_missing_native_teacher": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "offers_extralessonsoffer" e
                LEFT JOIN "employees_teacher" t ON t."id" = e."teacher_native_id"
                WHERE e."teacher_native_id" IS NOT NULL AND t."id" IS NULL
                """,
                """
                SELECT e."id", e."teacher_native_id"
                FROM "offers_extralessonsoffer" e
                LEFT JOIN "employees_teacher" t ON t."id" = e."teacher_native_id"
                WHERE e."teacher_native_id" IS NOT NULL AND t."id" IS NULL
                ORDER BY e."id"
                LIMIT %s
                """,
                limit,
            ),
            "offer_missing_student": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "offers_offer" o
                LEFT JOIN "students_student" s ON s."id" = o."student_id"
                WHERE s."id" IS NULL
                """,
                """
                SELECT o."uuid", o."student_id"
                FROM "offers_offer" o
                LEFT JOIN "students_student" s ON s."id" = o."student_id"
                WHERE s."id" IS NULL
                ORDER BY o."uuid"
                LIMIT %s
                """,
                limit,
            ),
            "offer_missing_teacher": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "offers_offer" o
                LEFT JOIN "employees_teacher" t ON t."id" = o."teacher_id"
                WHERE o."teacher_id" IS NOT NULL AND t."id" IS NULL
                """,
                """
                SELECT o."uuid", o."teacher_id"
                FROM "offers_offer" o
                LEFT JOIN "employees_teacher" t ON t."id" = o."teacher_id"
                WHERE o."teacher_id" IS NOT NULL AND t."id" IS NULL
                ORDER BY o."uuid"
                LIMIT %s
                """,
                limit,
            ),
            "offer_missing_offerer": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "offers_offer" o
                LEFT JOIN "auth_user" u ON u."id" = o."offerer_id"
                WHERE o."offerer_id" IS NOT NULL AND u."id" IS NULL
                """,
                """
                SELECT o."uuid", o."offerer_id"
                FROM "offers_offer" o
                LEFT JOIN "auth_user" u ON u."id" = o."offerer_id"
                WHERE o."offerer_id" IS NOT NULL AND u."id" IS NULL
                ORDER BY o."uuid"
                LIMIT %s
                """,
                limit,
            ),
            "offer_missing_course_product": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "offers_offer" o
                LEFT JOIN "products_product" p ON p."id" = o."course_product_id"
                WHERE o."course_product_id" IS NOT NULL AND p."id" IS NULL
                """,
                """
                SELECT o."uuid", o."course_product_id"
                FROM "offers_offer" o
                LEFT JOIN "products_product" p ON p."id" = o."course_product_id"
                WHERE o."course_product_id" IS NOT NULL AND p."id" IS NULL
                ORDER BY o."uuid"
                LIMIT %s
                """,
                limit,
            ),
            "offer_missing_extra_lessons": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "offers_offer" o
                LEFT JOIN "offers_extralessonsoffer" e ON e."id" = o."extra_lessons_id"
                WHERE o."extra_lessons_id" IS NOT NULL AND e."id" IS NULL
                """,
                """
                SELECT o."uuid", o."extra_lessons_id"
                FROM "offers_offer" o
                LEFT JOIN "offers_extralessonsoffer" e ON e."id" = o."extra_lessons_id"
                WHERE o."extra_lessons_id" IS NOT NULL AND e."id" IS NULL
                ORDER BY o."uuid"
                LIMIT %s
                """,
                limit,
            ),
            "offer_missing_order": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM "offers_offer" o
                LEFT JOIN "orders_order" ord ON ord."id" = o."order_id"
                WHERE o."order_id" IS NOT NULL AND ord."id" IS NULL
                """,
                """
                SELECT o."uuid", o."order_id"
                FROM "offers_offer" o
                LEFT JOIN "orders_order" ord ON ord."id" = o."order_id"
                WHERE o."order_id" IS NOT NULL AND ord."id" IS NULL
                ORDER BY o."uuid"
                LIMIT %s
                """,
                limit,
            ),
        },
    }


def fetch_key_values(conn, table: str, column: str) -> list[str]:
    cur = conn.cursor()
    cur.execute(f'SELECT {qname(column)}::text FROM "{table}" WHERE {qname(column)} IS NOT NULL')
    values = [str(row[0]) for row in cur.fetchall()]
    cur.close()
    return values


def fetch_pair_values(conn, table: str, columns: tuple[str, str]) -> set[tuple[str, str]]:
    cur = conn.cursor()
    cur.execute(
        f'SELECT {qname(columns[0])}::text, {qname(columns[1])}::text '
        f'FROM "{table}" WHERE {qname(columns[0])} IS NOT NULL AND {qname(columns[1])} IS NOT NULL'
    )
    pairs = {(str(row[0]), str(row[1])) for row in cur.fetchall()}
    cur.close()
    return pairs


def target_key_conflicts(tgt, table: str, column: str, source_values: list[str], limit: int) -> dict[str, object]:
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


def target_pair_conflicts(
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
        key_conflicts[f"{table}.{column}"] = target_key_conflicts(
            tgt,
            table,
            column,
            fetch_key_values(src, table, column),
            limit,
        )

    pair_conflicts: dict[str, object] = {}
    for table, columns in TARGET_PAIR_KEYS.items():
        pair_conflicts[f"{table}.{columns[0]}_{columns[1]}"] = target_pair_conflicts(
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


def target_conflict_total(target: dict[str, object]) -> int:
    total = 0
    for group_name in ("target_key_conflicts", "target_pair_conflicts"):
        for result in target[group_name].values():
            total += int(result["count"])
    return total


def log_target_conflicts(target: dict[str, object]) -> None:
    for group_name in ("target_key_conflicts", "target_pair_conflicts"):
        for name, result in target[group_name].items():
            if int(result["count"]) > 0:
                log(f"target conflict {name} count={result['count']} sample={result['sample']}")


def guard_no_target_conflicts(src, tgt, limit: int) -> bool:
    target = target_reconciliation(src, tgt, limit)
    conflicts = target_conflict_total(target)
    if conflicts == 0:
        log("write preflight target_conflicts=0 conflict_policy=fail")
        return True
    log(f"Refusing import: target_conflicts={conflicts} conflict_policy=fail")
    log_target_conflicts(target)
    log("Run --dry-run --check-target --json-report for the full reconciliation report.")
    return False


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
    parser.add_argument("--dry-run", action="store_true", help="produce reconciliation report without writes")
    parser.add_argument("--check-target", action="store_true", help="include target counts and key conflicts in dry-run")
    parser.add_argument("--json-report", action="store_true", help="print dry-run report as JSON")
    parser.add_argument("--limit", type=int, default=25, help="maximum sample rows per reconciliation bucket")
    parser.add_argument("--truncate-first", action="store_true", help="delete target course tables before import")
    parser.add_argument(
        "--allow-truncate-first",
        action="store_true",
        help="required with --truncate-first outside dry-run",
    )
    args = parser.parse_args()

    src_u = source_url()
    tgt_u = target_url()
    if not src_u:
        log("Missing COURSE_SOURCE_DATABASE_URL or SOURCE_DATABASE_URL")
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
            log("Missing COURSE_TARGET_DATABASE_URL or TARGET_DATABASE_URL")
            return 1
        tgt = connect(tgt_u)
        try:
            if not args.truncate_first and not guard_no_target_conflicts(src, tgt, max(args.limit, 1)):
                return 2
            migrate(src, tgt, args.truncate_first)
        finally:
            tgt.close()
    finally:
        src.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
