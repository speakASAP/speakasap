#!/usr/bin/env python3
"""
ETL: speakasap-portal Postgres (legacy) -> speakasap_user_db (user-service Prisma tables).

Env:
  SOURCE_DATABASE_URL — legacy Django DB (read-only recommended)
  TARGET_DATABASE_URL — user-service DATABASE_URL (speakasap_user_db)
  AUTH_DATABASE_URL   — auth-microservice Postgres for legacy_identity_mappings -> UUID mapping

Options:
  --dry-run          — reconciliation report only; no writes
  --check-target     — include target counts/conflict samples in dry run
  --json-report      — print machine-readable dry-run report
  --limit            — maximum sample rows per reconciliation bucket
  --truncate-first   — delete target user-domain tables (FK-safe order) before import
  --allow-truncate-first — required together with --truncate-first outside dry run

Identity:
  Target rows require auth_user_id (UUID) = auth-microservice users.id.
  Legacy portal user id is stored as legacy_portal_user_id (int).
  Resolution: match legacy auth_user.id to auth.legacy_identity_mappings.legacyUserId.
  Rows with no mapping are skipped with timestamped warnings (no placeholder UUIDs).

Table names: legacy Django defaults (students_student, employees_teacher, …).
Target physical names: see prisma/migrations/*_init_user_tables/migration.sql.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Install psycopg2-binary: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    print(f"{ts} {msg}", flush=True)


def connect(url: str):
    return psycopg2.connect(url, connect_timeout=30)


SOURCE_TABLES = [
    "students_student",
    "employees_teacher",
    "employees_teacher_additional_languages",
    "employees_manager",
    "employees_employeeprofile",
    "auth_user",
]

TARGET_TABLES = [
    "user_identity_mirror",
    "managers",
    "teachers",
    "students",
    "employee_profiles",
    "teacher_additional_languages",
]


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


def table_counts(conn, tables: list[str]) -> dict[str, int | str]:
    counts: dict[str, int | str] = {}
    cur = conn.cursor()
    for table in tables:
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


def unresolved_auth_report(src, auth_map: dict[int, str] | None, limit: int) -> dict[str, object]:
    if auth_map is None:
        return {"available": False, "reason": "AUTH_DATABASE_URL not set"}
    legacy_user_ids = sorted(auth_map.keys())
    cur = src.cursor()
    cur.execute("DROP TABLE IF EXISTS tmp_auth_mapping_legacy_user_ids")
    cur.execute("CREATE TEMP TABLE tmp_auth_mapping_legacy_user_ids (legacy_user_id integer) ON COMMIT DROP")
    if legacy_user_ids:
        psycopg2.extras.execute_values(
            cur,
            "INSERT INTO tmp_auth_mapping_legacy_user_ids (legacy_user_id) VALUES %s",
            [(legacy_user_id,) for legacy_user_id in legacy_user_ids],
            page_size=10000,
        )
    cur.close()
    checks = {
        "auth_user": """
            SELECT u.id, u.email
            FROM auth_user u
            LEFT JOIN tmp_auth_mapping_legacy_user_ids a ON a.legacy_user_id = u.id
            WHERE a.legacy_user_id IS NULL
        """,
        "students": """
            SELECT s.id, s.user_id, u.email
            FROM students_student s
            JOIN auth_user u ON u.id = s.user_id
            LEFT JOIN tmp_auth_mapping_legacy_user_ids a ON a.legacy_user_id = s.user_id
            WHERE a.legacy_user_id IS NULL
        """,
        "teachers": """
            SELECT t.id, t.user_id, u.email
            FROM employees_teacher t
            JOIN auth_user u ON u.id = t.user_id
            LEFT JOIN tmp_auth_mapping_legacy_user_ids a ON a.legacy_user_id = t.user_id
            WHERE a.legacy_user_id IS NULL
        """,
        "managers": """
            SELECT m.id, m.user_id, u.email
            FROM employees_manager m
            JOIN auth_user u ON u.id = m.user_id
            LEFT JOIN tmp_auth_mapping_legacy_user_ids a ON a.legacy_user_id = m.user_id
            WHERE a.legacy_user_id IS NULL
        """,
        "employee_profiles": """
            SELECT e.id, e.user_id, u.email
            FROM employees_employeeprofile e
            JOIN auth_user u ON u.id = e.user_id
            LEFT JOIN tmp_auth_mapping_legacy_user_ids a ON a.legacy_user_id = e.user_id
            WHERE a.legacy_user_id IS NULL
        """,
    }
    report: dict[str, object] = {"available": True, "auth_mapping_size": len(auth_map)}
    try:
        for name, base_sql in checks.items():
            report[name] = count_and_sample(
                src,
                f"SELECT COUNT(*) FROM ({base_sql}) unresolved",
                f"{base_sql} ORDER BY 1 LIMIT %s",
                limit,
            )
    finally:
        cur = src.cursor()
        cur.execute("DROP TABLE IF EXISTS tmp_auth_mapping_legacy_user_ids")
        cur.close()
    return report


def source_reconciliation(src, auth_map: dict[int, str] | None, limit: int) -> dict[str, object]:
    return {
        "source_counts": table_counts(src, SOURCE_TABLES),
        "duplicate_keys": {
            "auth_user.email": duplicate_key_report(
                src,
                "auth_user",
                ["email"],
                limit,
                "email IS NOT NULL AND trim(email) <> ''",
            ),
            "students_student.user_id": duplicate_key_report(src, "students_student", ["user_id"], limit),
            "employees_teacher.user_id": duplicate_key_report(src, "employees_teacher", ["user_id"], limit),
            "employees_manager.user_id": duplicate_key_report(src, "employees_manager", ["user_id"], limit),
            "employees_employeeprofile.user_id": duplicate_key_report(
                src,
                "employees_employeeprofile",
                ["user_id"],
                limit,
            ),
            "teacher_additional_languages.pair": duplicate_key_report(
                src,
                "employees_teacher_additional_languages",
                ["teacher_id", "language_id"],
                limit,
            ),
        },
        "missing_references": {
            "students_missing_auth_user": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM students_student s
                LEFT JOIN auth_user u ON u.id = s.user_id
                WHERE u.id IS NULL
                """,
                """
                SELECT s.id, s.user_id
                FROM students_student s
                LEFT JOIN auth_user u ON u.id = s.user_id
                WHERE u.id IS NULL
                ORDER BY s.id
                LIMIT %s
                """,
                limit,
            ),
            "students_missing_manager": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM students_student s
                LEFT JOIN employees_manager m ON m.id = s.manager_id
                WHERE s.manager_id IS NOT NULL AND m.id IS NULL
                """,
                """
                SELECT s.id, s.manager_id
                FROM students_student s
                LEFT JOIN employees_manager m ON m.id = s.manager_id
                WHERE s.manager_id IS NOT NULL AND m.id IS NULL
                ORDER BY s.id
                LIMIT %s
                """,
                limit,
            ),
            "teachers_missing_auth_user": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM employees_teacher t
                LEFT JOIN auth_user u ON u.id = t.user_id
                WHERE u.id IS NULL
                """,
                """
                SELECT t.id, t.user_id
                FROM employees_teacher t
                LEFT JOIN auth_user u ON u.id = t.user_id
                WHERE u.id IS NULL
                ORDER BY t.id
                LIMIT %s
                """,
                limit,
            ),
            "teachers_missing_language": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM employees_teacher t
                LEFT JOIN language_language l ON l.id = t.language_id
                WHERE l.id IS NULL
                """,
                """
                SELECT t.id, t.language_id
                FROM employees_teacher t
                LEFT JOIN language_language l ON l.id = t.language_id
                WHERE l.id IS NULL
                ORDER BY t.id
                LIMIT %s
                """,
                limit,
            ),
            "teacher_additional_languages_missing_teacher": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM employees_teacher_additional_languages rel
                LEFT JOIN employees_teacher t ON t.id = rel.teacher_id
                WHERE t.id IS NULL
                """,
                """
                SELECT rel.teacher_id, rel.language_id
                FROM employees_teacher_additional_languages rel
                LEFT JOIN employees_teacher t ON t.id = rel.teacher_id
                WHERE t.id IS NULL
                ORDER BY rel.teacher_id, rel.language_id
                LIMIT %s
                """,
                limit,
            ),
            "teacher_additional_languages_missing_language": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM employees_teacher_additional_languages rel
                LEFT JOIN language_language l ON l.id = rel.language_id
                WHERE l.id IS NULL
                """,
                """
                SELECT rel.teacher_id, rel.language_id
                FROM employees_teacher_additional_languages rel
                LEFT JOIN language_language l ON l.id = rel.language_id
                WHERE l.id IS NULL
                ORDER BY rel.teacher_id, rel.language_id
                LIMIT %s
                """,
                limit,
            ),
            "managers_missing_auth_user": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM employees_manager m
                LEFT JOIN auth_user u ON u.id = m.user_id
                WHERE u.id IS NULL
                """,
                """
                SELECT m.id, m.user_id
                FROM employees_manager m
                LEFT JOIN auth_user u ON u.id = m.user_id
                WHERE u.id IS NULL
                ORDER BY m.id
                LIMIT %s
                """,
                limit,
            ),
            "employee_profiles_missing_auth_user": count_and_sample(
                src,
                """
                SELECT COUNT(*)
                FROM employees_employeeprofile e
                LEFT JOIN auth_user u ON u.id = e.user_id
                WHERE u.id IS NULL
                """,
                """
                SELECT e.id, e.user_id
                FROM employees_employeeprofile e
                LEFT JOIN auth_user u ON u.id = e.user_id
                WHERE u.id IS NULL
                ORDER BY e.id
                LIMIT %s
                """,
                limit,
            ),
        },
        "unresolved_auth": unresolved_auth_report(src, auth_map, limit),
    }


def fetch_int_values(conn, table: str, column: str) -> list[int]:
    cur = conn.cursor()
    cur.execute(f"SELECT {qname(column)} FROM {qname(table)} WHERE {qname(column)} IS NOT NULL")
    values = [int(row[0]) for row in cur.fetchall()]
    cur.close()
    return values


def fetch_auth_uuids_for_source(src, auth_map: dict[int, str] | None, sql: str) -> list[str]:
    if auth_map is None:
        return []
    cur = src.cursor()
    cur.execute(sql)
    values: list[str] = []
    for (legacy_user_id,) in cur.fetchall():
        uid = auth_map.get(int(legacy_user_id))
        if uid:
            values.append(uid)
    cur.close()
    return values


def target_int_conflicts(tgt, table: str, column: str, source_values: list[int], limit: int) -> dict[str, object]:
    if not source_values:
        return {"count": 0, "sample": []}
    cur = tgt.cursor()
    cur.execute("DROP TABLE IF EXISTS tmp_migration_conflict_values")
    cur.execute("CREATE TEMP TABLE tmp_migration_conflict_values (value integer) ON COMMIT DROP")
    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO tmp_migration_conflict_values (value) VALUES %s",
        [(int(v),) for v in source_values],
        page_size=10000,
    )
    cur.execute(
        f"""
        SELECT COUNT(DISTINCT t.{qname(column)})
        FROM {qname(table)} t
        JOIN tmp_migration_conflict_values v ON v.value = t.{qname(column)}
        """
    )
    count = int(cur.fetchone()[0])
    cur.execute(
        f"""
        SELECT DISTINCT t.{qname(column)}
        FROM {qname(table)} t
        JOIN tmp_migration_conflict_values v ON v.value = t.{qname(column)}
        ORDER BY t.{qname(column)}
        LIMIT %s
        """,
        [limit],
    )
    sample = [int(row[0]) for row in cur.fetchall()]
    cur.execute("DROP TABLE IF EXISTS tmp_migration_conflict_values")
    cur.close()
    return {"count": count, "sample": sample}


def target_text_conflicts(tgt, table: str, column: str, source_values: list[str], limit: int) -> dict[str, object]:
    if not source_values:
        return {"count": 0, "sample": []}
    cur = tgt.cursor()
    cur.execute("DROP TABLE IF EXISTS tmp_migration_conflict_values")
    cur.execute("CREATE TEMP TABLE tmp_migration_conflict_values (value text) ON COMMIT DROP")
    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO tmp_migration_conflict_values (value) VALUES %s",
        [(str(v),) for v in source_values],
        page_size=10000,
    )
    cur.execute(
        f"""
        SELECT COUNT(DISTINCT t.{qname(column)}::text)
        FROM {qname(table)} t
        JOIN tmp_migration_conflict_values v ON v.value = t.{qname(column)}::text
        """
    )
    count = int(cur.fetchone()[0])
    cur.execute(
        f"""
        SELECT DISTINCT t.{qname(column)}::text
        FROM {qname(table)} t
        JOIN tmp_migration_conflict_values v ON v.value = t.{qname(column)}::text
        ORDER BY t.{qname(column)}::text
        LIMIT %s
        """,
        [limit],
    )
    sample = [str(row[0]) for row in cur.fetchall()]
    cur.execute("DROP TABLE IF EXISTS tmp_migration_conflict_values")
    cur.close()
    return {"count": count, "sample": sample}


def target_reconciliation(
    src,
    tgt,
    auth_map: dict[int, str] | None,
    limit: int,
) -> dict[str, object]:
    student_ids = fetch_int_values(src, "students_student", "id")
    teacher_ids = fetch_int_values(src, "employees_teacher", "id")
    manager_ids = fetch_int_values(src, "employees_manager", "id")
    employee_profile_ids = fetch_int_values(src, "employees_employeeprofile", "id")
    legacy_user_ids = fetch_int_values(src, "auth_user", "id")

    mirror_auth_ids = fetch_auth_uuids_for_source(
        src,
        auth_map,
        "SELECT id FROM auth_user",
    )
    student_auth_ids = fetch_auth_uuids_for_source(
        src,
        auth_map,
        """
        SELECT s.user_id
        FROM students_student s
        """,
    )
    teacher_auth_ids = fetch_auth_uuids_for_source(
        src,
        auth_map,
        """
        SELECT t.user_id
        FROM employees_teacher t
        """,
    )
    manager_auth_ids = fetch_auth_uuids_for_source(
        src,
        auth_map,
        """
        SELECT m.user_id
        FROM employees_manager m
        """,
    )
    employee_profile_auth_ids = fetch_auth_uuids_for_source(
        src,
        auth_map,
        """
        SELECT e.user_id
        FROM employees_employeeprofile e
        """,
    )

    return {
        "target_counts": table_counts(tgt, TARGET_TABLES),
        "target_id_conflicts": {
            "students.id": target_int_conflicts(tgt, "students", "id", student_ids, limit),
            "teachers.id": target_int_conflicts(tgt, "teachers", "id", teacher_ids, limit),
            "managers.id": target_int_conflicts(tgt, "managers", "id", manager_ids, limit),
            "employee_profiles.id": target_int_conflicts(
                tgt,
                "employee_profiles",
                "id",
                employee_profile_ids,
                limit,
            ),
            "user_identity_mirror.legacy_portal_user_id": target_int_conflicts(
                tgt,
                "user_identity_mirror",
                "legacy_portal_user_id",
                legacy_user_ids,
                limit,
            ),
        },
        "target_auth_conflicts": {
            "user_identity_mirror.auth_user_id": target_text_conflicts(
                tgt,
                "user_identity_mirror",
                "auth_user_id",
                mirror_auth_ids,
                limit,
            ),
            "students.auth_user_id": target_text_conflicts(tgt, "students", "auth_user_id", student_auth_ids, limit),
            "teachers.auth_user_id": target_text_conflicts(tgt, "teachers", "auth_user_id", teacher_auth_ids, limit),
            "managers.auth_user_id": target_text_conflicts(tgt, "managers", "auth_user_id", manager_auth_ids, limit),
            "employee_profiles.auth_user_id": target_text_conflicts(
                tgt,
                "employee_profiles",
                "auth_user_id",
                employee_profile_auth_ids,
                limit,
            ),
        },
        "replacement_scope": {
            "teacher_additional_languages_existing_total": query_count(
                tgt,
                'SELECT COUNT(*) FROM "teacher_additional_languages"',
            ),
            "teacher_additional_languages_for_source_teachers": target_int_conflicts(
                tgt,
                "teacher_additional_languages",
                "teacher_id",
                teacher_ids,
                limit,
            ),
        },
    }


def dry_run_report(
    src,
    auth=None,
    tgt=None,
    check_target: bool = False,
    limit: int = 25,
) -> dict[str, object]:
    auth_map = load_legacy_user_id_to_uuid(auth, log_index=False) if auth is not None else None
    report = {
        "dry_run": True,
        "writes": False,
        "source": source_reconciliation(src, auth_map, limit),
    }
    if check_target:
        if tgt is None:
            report["target"] = {"available": False, "reason": "TARGET_DATABASE_URL not set"}
        else:
            target = target_reconciliation(src, tgt, auth_map, limit)
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
    unresolved = source["unresolved_auth"]
    if not unresolved.get("available"):
        log(f"dry-run unresolved_auth skipped reason={unresolved.get('reason')}")
    else:
        log(f"dry-run auth_mapping_size={unresolved.get('auth_mapping_size')}")
        for name, result in unresolved.items():
            if name in ("available", "auth_mapping_size"):
                continue
            log(f"dry-run unresolved_auth {name} count={result['count']} sample={result['sample']}")
    target = report.get("target")
    if target:
        if not target.get("available"):
            log(f"dry-run target skipped reason={target.get('reason')}")
            return
        for table, count in target["target_counts"].items():
            log(f"dry-run target_count {table}={count}")
        for group, items in (
            ("target_id_conflict", target["target_id_conflicts"]),
            ("target_auth_conflict", target["target_auth_conflicts"]),
        ):
            for name, result in items.items():
                log(f"dry-run {group} {name} count={result['count']} sample={result['sample']}")
        scope = target["replacement_scope"]
        log(
            "dry-run replacement_scope teacher_additional_languages "
            f"existing_total={scope['teacher_additional_languages_existing_total']} "
            f"source_teacher_conflicts={scope['teacher_additional_languages_for_source_teachers']}"
        )


def truncate_target(tgt) -> None:
    cur = tgt.cursor()
    stmts = [
        'DELETE FROM "teacher_additional_languages"',
        'DELETE FROM "teachers"',
        'DELETE FROM "students"',
        'DELETE FROM "managers"',
        'DELETE FROM "employee_profiles"',
        'DELETE FROM "user_identity_mirror"',
    ]
    for s in stmts:
        log(f"truncate step: {s}")
        cur.execute(s)
    tgt.commit()
    cur.close()


def load_legacy_user_id_to_uuid(auth, log_index: bool = True) -> dict[int, str]:
    """Legacy speakasap-portal auth_user.id -> auth users.id::text."""
    cur = auth.cursor()
    cur.execute(
        """
        SELECT "legacyUserId"::int, "authUserId"::text
        FROM legacy_identity_mappings
        WHERE "legacySystem" = %s
          AND "authUserId" IS NOT NULL
        """,
        ("speakasap-portal",),
    )
    m: dict[int, str] = {}
    for legacy_user_id, auth_user_id in cur.fetchall():
        m[int(legacy_user_id)] = auth_user_id
    cur.close()
    if log_index:
        log(f"auth users indexed by legacy mapping: {len(m)}")
    return m


def migrate_user_mirror(src, tgt, auth_map: dict[int, str]) -> tuple[int, int]:
    """auth_user rows that resolve to a UUID: upsert user_identity_mirror."""
    sql = """
    SELECT id, first_name, last_name, COALESCE(email,'') AS email, COALESCE(phone,'') AS phone,
           COALESCE(language,'ru') AS language, COALESCE(country,'ru') AS country,
           COALESCE(image::text, '') AS image
      FROM auth_user
    """
    ins = """
    INSERT INTO user_identity_mirror (
      auth_user_id, legacy_portal_user_id, first_name, last_name, email, phone,
      interface_language, user_country, avatar_storage_key, updated_at
    ) VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, NULLIF(%s,''), NOW())
    ON CONFLICT (auth_user_id) DO UPDATE SET
      legacy_portal_user_id = EXCLUDED.legacy_portal_user_id,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      interface_language = EXCLUDED.interface_language,
      user_country = EXCLUDED.user_country,
      avatar_storage_key = EXCLUDED.avatar_storage_key,
      updated_at = NOW()
    """
    s = src.cursor()
    s.execute(sql)
    rows = s.fetchall()
    t = tgt.cursor()
    n = 0
    skipped = 0
    for r in rows:
        uid = auth_map.get(int(r[0]))
        if not uid:
            skipped += 1
            continue
        img = (r[7] or "").strip()
        t.execute(
            ins,
            (
                uid,
                int(r[0]),
                r[1] or "",
                r[2] or "",
                r[3] or "",
                r[4] or "",
                (r[5] or "ru")[:10],
                (r[6] or "ru")[:10],
                img,
            ),
        )
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n, skipped


def migrate_managers(src, tgt, auth_map: dict[int, str]) -> tuple[int, int]:
    sql = """
    SELECT m.id, m.user_id,
           m.description, COALESCE(m.position,'') AS position, COALESCE(m.contract_name,'') AS contract_name,
           COALESCE(m.passport_number,'') AS passport_number, COALESCE(m.address,'') AS address,
           COALESCE(m.postal_code,'') AS postal_code, COALESCE(m.city,'') AS city,
           COALESCE(m.address_cz,'') AS address_cz, COALESCE(m.city_cz,'') AS city_cz
      FROM employees_manager m
    """
    ins = """
    INSERT INTO managers (
      id, auth_user_id, legacy_portal_user_id, description, position, contract_name,
      passport_number, address, postal_code, city, address_cz, city_cz
    ) VALUES (%s, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (auth_user_id) DO UPDATE SET
      legacy_portal_user_id = EXCLUDED.legacy_portal_user_id,
      description = EXCLUDED.description,
      position = EXCLUDED.position,
      contract_name = EXCLUDED.contract_name,
      passport_number = EXCLUDED.passport_number,
      address = EXCLUDED.address,
      postal_code = EXCLUDED.postal_code,
      city = EXCLUDED.city,
      address_cz = EXCLUDED.address_cz,
      city_cz = EXCLUDED.city_cz
    """
    s = src.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    t = tgt.cursor()
    s.execute(sql)
    rows = s.fetchall()
    n = 0
    skipped = 0
    for r in rows:
        uid = auth_map.get(int(r["user_id"]))
        if not uid:
            skipped += 1
            log(f"skip manager legacy id={r['id']} user_id={r['user_id']} (no auth UUID for legacy user id)")
            continue
        t.execute(
            ins,
            (
                r["id"],
                uid,
                int(r["user_id"]),
                r["description"],
                r["position"],
                r["contract_name"],
                r["passport_number"],
                r["address"],
                r["postal_code"],
                r["city"],
                r["address_cz"],
                r["city_cz"],
            ),
        )
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n, skipped


def migrate_teachers(src, tgt, auth_map: dict[int, str]) -> tuple[int, int, int]:
    sql = """
    SELECT t.id, t.user_id,
           t.description, COALESCE(t.position,'') AS position, COALESCE(t.contract_name,'') AS contract_name,
           COALESCE(t.passport_number,'') AS passport_number, COALESCE(t.address,'') AS address,
           COALESCE(t.postal_code,'') AS postal_code, COALESCE(t.city,'') AS city,
           COALESCE(t.address_cz,'') AS address_cz, COALESCE(t.city_cz,'') AS city_cz,
           COALESCE(lang.code,'') AS language_code,
           t.russian, t.native, t.language_support, t.can_get_students,
           COALESCE(t.coordinator_info,'') AS coordinator_info,
           t.work_since, t.contract_end
      FROM employees_teacher t
      JOIN language_language lang ON lang.id = t.language_id
    """
    ins = """
    INSERT INTO teachers (
      id, auth_user_id, legacy_portal_user_id, description, position, contract_name,
      passport_number, address, postal_code, city, address_cz, city_cz,
      language_code, russian, native, language_support, can_get_students,
      coordinator_info, work_since, contract_end
    ) VALUES (
      %s, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
      %s, %s, %s, %s, %s, %s, %s, %s
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      legacy_portal_user_id = EXCLUDED.legacy_portal_user_id,
      description = EXCLUDED.description,
      position = EXCLUDED.position,
      contract_name = EXCLUDED.contract_name,
      passport_number = EXCLUDED.passport_number,
      address = EXCLUDED.address,
      postal_code = EXCLUDED.postal_code,
      city = EXCLUDED.city,
      address_cz = EXCLUDED.address_cz,
      city_cz = EXCLUDED.city_cz,
      language_code = EXCLUDED.language_code,
      russian = EXCLUDED.russian,
      native = EXCLUDED.native,
      language_support = EXCLUDED.language_support,
      can_get_students = EXCLUDED.can_get_students,
      coordinator_info = EXCLUDED.coordinator_info,
      work_since = EXCLUDED.work_since,
      contract_end = EXCLUDED.contract_end
    """
    s = src.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    t = tgt.cursor()
    s.execute(sql)
    rows = s.fetchall()
    n = 0
    skipped = 0
    lang_rows = 0
    for r in rows:
        uid = auth_map.get(int(r["user_id"]))
        if not uid:
            skipped += 1
            log(f"skip teacher legacy id={r['id']} user_id={r['user_id']} (no auth UUID for legacy user id)")
            continue
        t.execute(
            ins,
            (
                r["id"],
                uid,
                int(r["user_id"]),
                r["description"],
                r["position"],
                r["contract_name"],
                r["passport_number"],
                r["address"],
                r["postal_code"],
                r["city"],
                r["address_cz"],
                r["city_cz"],
                r["language_code"] or "en",
                r["russian"],
                r["native"],
                r["language_support"],
                r["can_get_students"],
                r["coordinator_info"],
                r["work_since"],
                r["contract_end"],
            ),
        )
        n += 1
    tgt.commit()

    # M2M: employees_teacher_additional_languages -> teacher_additional_languages (legacy teacher PK = target teacher id)
    m2m_sql = """
    SELECT rel.teacher_id, COALESCE(lang.code,'') AS code
      FROM employees_teacher_additional_languages rel
      JOIN language_language lang ON lang.id = rel.language_id
    """
    t.execute('DELETE FROM teacher_additional_languages')
    tgt.commit()
    # Use a tuple cursor here: teacher query above uses RealDictCursor.
    s_m2m = src.cursor()
    s_m2m.execute(m2m_sql)
    for rel in s_m2m.fetchall():
        tid, code = rel[0], rel[1]
        if not code:
            continue
        t.execute("SELECT 1 FROM teachers WHERE id = %s", (tid,))
        if t.fetchone() is None:
            continue
        try:
            t.execute(
                """
                INSERT INTO teacher_additional_languages (teacher_id, language_code)
                VALUES (%s, %s)
                ON CONFLICT (teacher_id, language_code) DO NOTHING
                """,
                (tid, code[:32]),
            )
            lang_rows += 1
        except Exception as e:
            log(f"warn M2M teacher_id={tid} code={code}: {e}")
    tgt.commit()
    s_m2m.close()
    s.close()
    t.close()
    return n, skipped, lang_rows


def migrate_students(src, tgt, auth_map: dict[int, str]) -> tuple[int, int]:
    sql = """
    SELECT s.id, s.user_id,
           s.not_loyal, s.spam_bot, s.do_not_contact,
           COALESCE(s.email_additional,'') AS email_additional,
           s.manager_id,
           COALESCE(s.telegram,'') AS telegram, COALESCE(s.whatsapp,'') AS whatsapp,
           COALESCE(s.phone_additional,'') AS phone_additional,
           s.read_help, COALESCE(s.motivation,'') AS motivation,
           COALESCE(s.portrait,'') AS portrait, COALESCE(s.sales_info,'') AS sales_info,
           COALESCE(s.country,'ru') AS country, COALESCE(s.invoice_address,'') AS invoice_address
      FROM students_student s
    """
    ins = """
    INSERT INTO students (
      id, auth_user_id, legacy_portal_user_id, not_loyal, spam_bot, do_not_contact,
      email_additional, manager_id, telegram, whatsapp, phone_additional,
      read_help, motivation, portrait, sales_info, country, invoice_address
    ) VALUES (
      %s, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      legacy_portal_user_id = EXCLUDED.legacy_portal_user_id,
      not_loyal = EXCLUDED.not_loyal,
      spam_bot = EXCLUDED.spam_bot,
      do_not_contact = EXCLUDED.do_not_contact,
      email_additional = EXCLUDED.email_additional,
      manager_id = EXCLUDED.manager_id,
      telegram = EXCLUDED.telegram,
      whatsapp = EXCLUDED.whatsapp,
      phone_additional = EXCLUDED.phone_additional,
      read_help = EXCLUDED.read_help,
      motivation = EXCLUDED.motivation,
      portrait = EXCLUDED.portrait,
      sales_info = EXCLUDED.sales_info,
      country = EXCLUDED.country,
      invoice_address = EXCLUDED.invoice_address
    """
    s = src.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    t = tgt.cursor()
    s.execute(sql)
    rows = s.fetchall()
    n = 0
    skipped = 0
    for r in rows:
        uid = auth_map.get(int(r["user_id"]))
        if not uid:
            skipped += 1
            continue
        mid = r["manager_id"]
        if mid is not None:
            t.execute("SELECT 1 FROM managers WHERE id = %s", (mid,))
            if t.fetchone() is None:
                mid = None
        t.execute(
            ins,
            (
                r["id"],
                uid,
                int(r["user_id"]),
                r["not_loyal"],
                r["spam_bot"],
                r["do_not_contact"],
                r["email_additional"],
                mid,
                r["telegram"],
                r["whatsapp"],
                r["phone_additional"],
                r["read_help"],
                r["motivation"],
                r["portrait"],
                r["sales_info"],
                r["country"],
                r["invoice_address"],
            ),
        )
        n += 1
    tgt.commit()
    s.close()
    t.close()
    if skipped:
        log(f"students skipped_no_auth total={skipped} (per-row logs omitted; see dry-run counts)")
    return n, skipped


def migrate_employee_profiles(src, tgt, auth_map: dict[int, str]) -> tuple[int, int]:
    sql = """
    SELECT e.id, e.user_id,
           e.additional_info, e.description, e.position
      FROM employees_employeeprofile e
    """
    ins = """
    INSERT INTO employee_profiles (
      id, auth_user_id, legacy_portal_user_id, additional_info, description, position
    ) VALUES (%s, %s::uuid, %s, %s, %s, %s)
    ON CONFLICT (auth_user_id) DO UPDATE SET
      legacy_portal_user_id = EXCLUDED.legacy_portal_user_id,
      additional_info = EXCLUDED.additional_info,
      description = EXCLUDED.description,
      position = EXCLUDED.position
    """
    s = src.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    t = tgt.cursor()
    s.execute(sql)
    rows = s.fetchall()
    n = 0
    skipped = 0
    for r in rows:
        uid = auth_map.get(int(r["user_id"]))
        if not uid:
            skipped += 1
            continue
        t.execute(
            ins,
            (
                r["id"],
                uid,
                int(r["user_id"]),
                r["additional_info"],
                r["description"],
                r["position"],
            ),
        )
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n, skipped


def reset_sequences(tgt) -> None:
    cur = tgt.cursor()
    for seq_table in [
        ("students_id_seq", "students"),
        ("teachers_id_seq", "teachers"),
        ("managers_id_seq", "managers"),
        ("employee_profiles_id_seq", "employee_profiles"),
    ]:
        try:
            cur.execute(
                f"SELECT setval('{seq_table[0]}', COALESCE((SELECT MAX(id) FROM {seq_table[1]}), 1))"
            )
            log(f"sequence reset {seq_table[0]}")
        except Exception as e:
            log(f"sequence reset {seq_table[0]} skip: {e}")
    tgt.commit()
    cur.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="produce reconciliation report without writes")
    ap.add_argument("--check-target", action="store_true", help="include target counts and conflicts in dry run")
    ap.add_argument("--json-report", action="store_true", help="print dry-run report as JSON")
    ap.add_argument("--limit", type=int, default=25, help="maximum sample rows per reconciliation bucket")
    ap.add_argument("--truncate-first", action="store_true", help="delete target user tables before import")
    ap.add_argument(
        "--allow-truncate-first",
        action="store_true",
        help="required with --truncate-first outside dry-run",
    )
    args = ap.parse_args()

    src_url = os.environ.get("SOURCE_DATABASE_URL")
    tgt_url = os.environ.get("TARGET_DATABASE_URL")
    auth_url = os.environ.get("AUTH_DATABASE_URL")

    if not src_url:
        log("ERROR: SOURCE_DATABASE_URL required")
        return 1
    if not args.dry_run and args.truncate_first and not args.allow_truncate_first:
        log("Refusing --truncate-first without --allow-truncate-first")
        return 2

    if not (args.dry_run and args.json_report):
        log("connecting source")
    src = connect(src_url)
    if args.dry_run:
        auth = connect(auth_url) if auth_url else None
        tgt = connect(tgt_url) if args.check_target and tgt_url else None
        try:
            report = dry_run_report(
                src,
                auth=auth,
                tgt=tgt,
                check_target=args.check_target,
                limit=max(args.limit, 1),
            )
            emit_report(report, args.json_report)
        finally:
            if tgt is not None:
                tgt.close()
            if auth is not None:
                auth.close()
            src.close()
        return 0

    if not tgt_url:
        log("ERROR: TARGET_DATABASE_URL required")
        src.close()
        return 1
    if not auth_url:
        log("ERROR: AUTH_DATABASE_URL required for import (legacy identity mapping -> UUID)")
        src.close()
        return 1

    tgt = connect(tgt_url)
    auth = connect(auth_url)
    auth_map = load_legacy_user_id_to_uuid(auth)
    auth.close()

    if args.truncate_first:
        truncate_target(tgt)

    t0 = time.time()
    n_mir, sk_mir = migrate_user_mirror(src, tgt, auth_map)
    log(f"user_identity_mirror upserted={n_mir} skipped_no_auth={sk_mir}")

    n_man, sk_man = migrate_managers(src, tgt, auth_map)
    log(f"managers upserted={n_man} skipped={sk_man}")

    n_t, sk_t, n_lang = migrate_teachers(src, tgt, auth_map)
    log(f"teachers upserted={n_t} skipped={sk_t} teacher_additional_languages rows={n_lang}")

    n_s, sk_s = migrate_students(src, tgt, auth_map)
    log(f"students upserted={n_s} skipped={sk_s}")

    n_e, sk_e = migrate_employee_profiles(src, tgt, auth_map)
    log(f"employee_profiles upserted={n_e} skipped={sk_e}")

    reset_sequences(tgt)

    log(f"done elapsed_s={time.time() - t0:.1f}")
    src.close()
    tgt.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
