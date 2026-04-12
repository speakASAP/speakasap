#!/usr/bin/env python3
"""
ETL: speakasap-portal Postgres (legacy) -> speakasap_user_db (user-service Prisma tables).

Env:
  SOURCE_DATABASE_URL — legacy Django DB (read-only recommended)
  TARGET_DATABASE_URL — user-service DATABASE_URL (speakasap_user_db)
  AUTH_DATABASE_URL   — auth-microservice Postgres (table "users") for email -> UUID mapping

Options:
  --dry-run          — source row counts + unresolved-auth counts only; no writes
  --truncate-first   — delete target user-domain tables (FK-safe order) before import

Identity:
  Target rows require auth_user_id (UUID) = auth-microservice users.id.
  Legacy portal user id is stored as legacy_portal_user_id (int).
  Resolution: match auth_user.email (legacy) to users.email (auth DB), case-insensitive.
  Rows with no match are skipped with timestamped warnings (no placeholder UUIDs).

Table names: legacy Django defaults (students_student, employees_teacher, …).
Target physical names: see prisma/migrations/*_init_user_tables/migration.sql.
"""
from __future__ import annotations

import argparse
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


def dry_run_counts(src) -> None:
    tables = [
        "students_student",
        "employees_teacher",
        "employees_teacher_additional_languages",
        "employees_manager",
        "employees_employeeprofile",
        "auth_user",
    ]
    cur = src.cursor()
    for t in tables:
        try:
            cur.execute('SELECT COUNT(*) FROM "{}"'.format(t.replace('"', "")))
            n = cur.fetchone()[0]
            log(f"dry-run count {t}={n}")
        except Exception as e:
            log(f"dry-run count {t} ERROR: {e}")
    cur.close()


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


def load_email_to_uuid(auth) -> dict[str, str]:
    """Lowercased trimmed email -> users.id::text."""
    cur = auth.cursor()
    cur.execute('SELECT id::text, lower(trim(email)) AS em FROM users WHERE email IS NOT NULL AND trim(email) <> %s', ("",))
    m: dict[str, str] = {}
    for uid, em in cur.fetchall():
        if em:
            m[em] = uid
    cur.close()
    log(f"auth users indexed by email: {len(m)}")
    return m


def migrate_user_mirror(src, tgt, email_map: dict[str, str]) -> tuple[int, int]:
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
        uid = email_map.get((r[3] or "").strip().lower())
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


def migrate_managers(src, tgt, email_map: dict[str, str]) -> tuple[int, int]:
    sql = """
    SELECT m.id, m.user_id,
           m.description, COALESCE(m.position,'') AS position, COALESCE(m.contract_name,'') AS contract_name,
           COALESCE(m.passport_number,'') AS passport_number, COALESCE(m.address,'') AS address,
           COALESCE(m.postal_code,'') AS postal_code, COALESCE(m.city,'') AS city,
           COALESCE(m.address_cz,'') AS address_cz, COALESCE(m.city_cz,'') AS city_cz,
           lower(trim(COALESCE(u.email,''))) AS lemail
      FROM employees_manager m
      JOIN auth_user u ON u.id = m.user_id
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
        uid = email_map.get(r["lemail"] or "")
        if not uid:
            skipped += 1
            log(f"skip manager legacy id={r['id']} user_id={r['user_id']} (no auth UUID for email)")
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


def migrate_teachers(src, tgt, email_map: dict[str, str]) -> tuple[int, int, int]:
    sql = """
    SELECT t.id, t.user_id,
           t.description, COALESCE(t.position,'') AS position, COALESCE(t.contract_name,'') AS contract_name,
           COALESCE(t.passport_number,'') AS passport_number, COALESCE(t.address,'') AS address,
           COALESCE(t.postal_code,'') AS postal_code, COALESCE(t.city,'') AS city,
           COALESCE(t.address_cz,'') AS address_cz, COALESCE(t.city_cz,'') AS city_cz,
           COALESCE(lang.code,'') AS language_code,
           t.russian, t.native, t.language_support, t.can_get_students,
           COALESCE(t.coordinator_info,'') AS coordinator_info,
           t.work_since, t.contract_end,
           lower(trim(COALESCE(u.email,''))) AS lemail
      FROM employees_teacher t
      JOIN auth_user u ON u.id = t.user_id
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
        uid = email_map.get(r["lemail"] or "")
        if not uid:
            skipped += 1
            log(f"skip teacher legacy id={r['id']} user_id={r['user_id']} (no auth UUID for email)")
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
    s.execute(m2m_sql)
    for rel in s.fetchall():
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
    s.close()
    t.close()
    return n, skipped, lang_rows


def migrate_students(src, tgt, email_map: dict[str, str]) -> tuple[int, int]:
    sql = """
    SELECT s.id, s.user_id,
           s.not_loyal, s.spam_bot, s.do_not_contact,
           COALESCE(s.email_additional,'') AS email_additional,
           s.manager_id,
           COALESCE(s.telegram,'') AS telegram, COALESCE(s.whatsapp,'') AS whatsapp,
           COALESCE(s.phone_additional,'') AS phone_additional,
           s.read_help, COALESCE(s.motivation,'') AS motivation,
           COALESCE(s.portrait,'') AS portrait, COALESCE(s.sales_info,'') AS sales_info,
           COALESCE(s.country,'ru') AS country, COALESCE(s.invoice_address,'') AS invoice_address,
           lower(trim(COALESCE(u.email,''))) AS lemail
      FROM students_student s
      JOIN auth_user u ON u.id = s.user_id
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
        uid = email_map.get(r["lemail"] or "")
        if not uid:
            skipped += 1
            log(f"skip student legacy id={r['id']} user_id={r['user_id']} (no auth UUID for email)")
            continue
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
                r["manager_id"],
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
    return n, skipped


def migrate_employee_profiles(src, tgt, email_map: dict[str, str]) -> tuple[int, int]:
    sql = """
    SELECT e.id, e.user_id,
           e.additional_info, e.description, e.position,
           lower(trim(COALESCE(u.email,''))) AS lemail
      FROM employees_employeeprofile e
      JOIN auth_user u ON u.id = e.user_id
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
        uid = email_map.get(r["lemail"] or "")
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
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--truncate-first", action="store_true")
    args = ap.parse_args()

    src_url = os.environ.get("SOURCE_DATABASE_URL")
    tgt_url = os.environ.get("TARGET_DATABASE_URL")
    auth_url = os.environ.get("AUTH_DATABASE_URL")

    if not src_url or not tgt_url:
        log("ERROR: SOURCE_DATABASE_URL and TARGET_DATABASE_URL required")
        return 1

    log("connecting source")
    src = connect(src_url)
    if args.dry_run:
        dry_run_counts(src)
        if auth_url:
            auth = connect(auth_url)
            em = load_email_to_uuid(auth)
            auth.close()
            log(f"dry-run auth index size={len(em)}")
        else:
            log("dry-run: AUTH_DATABASE_URL not set (full import will require it)")
        src.close()
        return 0

    if not auth_url:
        log("ERROR: AUTH_DATABASE_URL required for import (email -> UUID)")
        src.close()
        return 1

    tgt = connect(tgt_url)
    auth = connect(auth_url)
    email_map = load_email_to_uuid(auth)
    auth.close()

    if args.truncate_first:
        truncate_target(tgt)

    t0 = time.time()
    n_mir, sk_mir = migrate_user_mirror(src, tgt, email_map)
    log(f"user_identity_mirror upserted={n_mir} skipped_no_auth={sk_mir}")

    n_man, sk_man = migrate_managers(src, tgt, email_map)
    log(f"managers upserted={n_man} skipped={sk_man}")

    n_t, sk_t, n_lang = migrate_teachers(src, tgt, email_map)
    log(f"teachers upserted={n_t} skipped={sk_t} teacher_additional_languages rows={n_lang}")

    n_s, sk_s = migrate_students(src, tgt, email_map)
    log(f"students upserted={n_s} skipped={sk_s}")

    n_e, sk_e = migrate_employee_profiles(src, tgt, email_map)
    log(f"employee_profiles upserted={n_e} skipped={sk_e}")

    reset_sequences(tgt)

    log(f"done elapsed_s={time.time() - t0:.1f}")
    src.close()
    tgt.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
