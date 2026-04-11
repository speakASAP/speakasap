#!/usr/bin/env python3
"""
One-off ETL: speakasap-portal Postgres (legacy) -> speakasap_certification_db (Prisma schema).

Env:
  SOURCE_DATABASE_URL — legacy Django DB (read-only recommended)
  TARGET_DATABASE_URL — certification-service DATABASE_URL

Options:
  --dry-run — count source rows only; no writes
  --truncate-first — delete target domain rows before import (order respects FKs)

Does not migrate language_tests / user_tests (assessment domain).

Table names follow Django defaults. If your deployment renamed tables, adjust SQL in this file.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any

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
        "certificates_certificate",
        "education_certificates_certificate",
        "quests_quest",
        "user_quest_questionnaire",
        "user_quest_question",
        "user_quest_userquestionnaire",
        "user_quest_answer",
    ]
    cur = src.cursor()
    for t in tables:
        cur.execute('SELECT COUNT(*) FROM "{}"'.format(t.replace('"', "")))
        n = cur.fetchone()[0]
        log(f"dry-run count {t}={n}")
    cur.close()


def truncate_target(tgt) -> None:
    cur = tgt.cursor()
    stmts = [
        'DELETE FROM "UserQuestionnaireAnswer"',
        'DELETE FROM "UserQuestionnaire"',
        'DELETE FROM "QuestionnaireQuestion"',
        'DELETE FROM "Questionnaire"',
        'DELETE FROM "QuestInstance"',
        'DELETE FROM "CourseCertificate"',
        'DELETE FROM "EducationCertificate"',
    ]
    for s in stmts:
        log(f"truncate step: {s}")
        cur.execute(s)
    tgt.commit()
    cur.close()


def migrate_course_certificates(src, tgt) -> int:
    sql = """
    SELECT c.id, c.course_id::text AS sc_uuid, COALESCE(c.image::text, '') AS img,
           (SELECT u.id::text
              FROM education_studentcourse sc2
              JOIN education_group_students gs ON gs.group_id = sc2.group_id
              JOIN students_student st ON st.id = gs.student_id
              JOIN auth_user u ON u.id = st.user_id
             WHERE sc2.uuid = c.course_id
             ORDER BY gs.student_id
             LIMIT 1) AS owner_user_id
      FROM certificates_certificate c
    """
    ins = """
    INSERT INTO "CourseCertificate" ("id", "studentCourseId", "ownerUserId", "imagePath", "certText", "createdAt")
    VALUES (%s, %s, %s, %s, %s, NOW())
    ON CONFLICT ("studentCourseId") DO UPDATE SET
      "imagePath" = EXCLUDED."imagePath",
      "ownerUserId" = COALESCE(EXCLUDED."ownerUserId", "CourseCertificate"."ownerUserId")
    """
    s = src.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    t = tgt.cursor()
    s.execute(sql)
    rows = s.fetchall()
    n = 0
    for r in rows:
        path = (r["img"] or "").strip()
        if path.startswith("certificates/"):
            pass
        elif path:
            path = path.lstrip("/")
        owner = r["owner_user_id"]
        t.execute(ins, (r["id"], r["sc_uuid"], owner, path, None))
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n


def migrate_education_certificates(src, tgt) -> int:
    sql = """
    SELECT ec.id, ec.student_course_id::text AS sc_uuid, ec.student_id,
           COALESCE(ec.image::text, '') AS img,
           u.id::text AS owner_user_id
      FROM education_certificates_certificate ec
      JOIN education_studentcourse sc ON sc.uuid = ec.student_course_id
      JOIN education_group_students gs ON gs.group_id = sc.group_id AND gs.student_id = ec.student_id
      JOIN students_student st ON st.id = ec.student_id
      JOIN auth_user u ON u.id = st.user_id
    """
    ins = """
    INSERT INTO "EducationCertificate" ("id", "studentCourseId", "studentId", "ownerUserId", "imagePath", "certText", "createdAt")
    VALUES (%s, %s, %s, %s, %s, %s, NOW())
    ON CONFLICT ("studentCourseId", "studentId") DO UPDATE SET
      "imagePath" = EXCLUDED."imagePath",
      "ownerUserId" = COALESCE(EXCLUDED."ownerUserId", "EducationCertificate"."ownerUserId")
    """
    s = src.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    t = tgt.cursor()
    s.execute(sql)
    rows = s.fetchall()
    n = 0
    for r in rows:
        path = (r["img"] or "").strip().lstrip("/")
        t.execute(ins, (r["id"], r["sc_uuid"], r["student_id"], r["owner_user_id"], path, None))
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n


def migrate_quests(src, tgt) -> int:
    sql = """
    SELECT uuid::text, user_id::text, code,
           questions, answers, identifier, created, completed
      FROM quests_quest
    """
    ins = """
    INSERT INTO "QuestInstance" ("id", "userId", "code", "identifier", "questions", "answers", "completedAt", "createdAt", "studentCourseRef", "studentPk")
    VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, NULL, NULL)
    ON CONFLICT ("id") DO UPDATE SET
      "questions" = EXCLUDED."questions",
      "answers" = EXCLUDED."answers",
      "completedAt" = EXCLUDED."completedAt"
    """
    s = src.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    t = tgt.cursor()
    s.execute(sql)
    rows = s.fetchall()
    n = 0
    for r in rows:
        ident = r["identifier"]
        if isinstance(ident, str):
            ident = json.loads(ident)
        qj = r["questions"]
        if isinstance(qj, str):
            qj = json.loads(qj or "{}")
        aj = r["answers"]
        if isinstance(aj, str):
            aj = json.loads(aj or "{}")
        t.execute(
            ins,
            (
                r["uuid"],
                r["user_id"],
                r["code"],
                psycopg2.extras.Json(ident),
                psycopg2.extras.Json(qj),
                psycopg2.extras.Json(aj),
                r["completed"],
                r["created"],
            ),
        )
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n


def migrate_questionnaires(src, tgt) -> None:
    s = src.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    t = tgt.cursor()
    s.execute("SELECT id, title FROM user_quest_questionnaire ORDER BY id")
    for r in s.fetchall():
        t.execute(
            'INSERT INTO "Questionnaire" ("id", "title") VALUES (%s, %s) ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title"',
            (r["id"], r["title"]),
        )
    tgt.commit()

    s.execute(
        """
        SELECT q.id, q.questionnaire_id, q.text, COALESCE(q.header, ''), q._order
          FROM user_quest_question q
         ORDER BY q.questionnaire_id, q._order, q.id
        """
    )
    for r in s.fetchall():
        t.execute(
            """
            INSERT INTO "QuestionnaireQuestion" ("id", "questionnaireId", "text", "header", "sortOrder")
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT ("id") DO UPDATE SET
              "text" = EXCLUDED."text",
              "header" = EXCLUDED."header",
              "sortOrder" = EXCLUDED."sortOrder"
            """,
            (r["id"], r["questionnaire_id"], r["text"], r["header"] or None, r["_order"]),
        )
    tgt.commit()

    s.execute(
        """
        SELECT id, questionnaire_id, user_id::text, created, finished, notification_template
          FROM user_quest_userquestionnaire
         ORDER BY id
        """
    )
    for r in s.fetchall():
        t.execute(
            """
            INSERT INTO "UserQuestionnaire" ("id", "questionnaireId", "userId", "createdAt", "finishedAt", "notificationTemplate")
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT ("id") DO UPDATE SET
              "finishedAt" = EXCLUDED."finishedAt",
              "notificationTemplate" = EXCLUDED."notificationTemplate"
            """,
            (
                r["id"],
                r["questionnaire_id"],
                r["user_id"],
                r["created"],
                r["finished"],
                r["notification_template"] or "quest_created",
            ),
        )
    tgt.commit()

    s.execute(
        """
        SELECT a.user_questionnaire_id, a.question_id, a.text
          FROM user_quest_answer a
         ORDER BY a.user_questionnaire_id, a.question_id
        """
    )
    for r in s.fetchall():
        t.execute(
            """
            INSERT INTO "UserQuestionnaireAnswer" ("userQuestionnaireId", "questionId", "text")
            VALUES (%s, %s, %s)
            ON CONFLICT ("userQuestionnaireId", "questionId") DO UPDATE SET
              "text" = EXCLUDED."text"
            """,
            (r["user_questionnaire_id"], r["question_id"], r["text"]),
        )
    tgt.commit()
    s.close()
    t.close()


def set_sequences(tgt) -> None:
    cur = tgt.cursor()
    for table, col in (
        ("CourseCertificate", "id"),
        ("EducationCertificate", "id"),
        ("Questionnaire", "id"),
        ("QuestionnaireQuestion", "id"),
        ("UserQuestionnaire", "id"),
    ):
        cur.execute(
            'SELECT setval(pg_get_serial_sequence(\'"{}"\', \'{}\'), '
            '(SELECT COALESCE(MAX("{}"), 1) FROM "{}"), true)'.format(table, col, col, table)
        )
    tgt.commit()
    cur.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--truncate-first", action="store_true")
    args = ap.parse_args()
    src_url = os.environ.get("SOURCE_DATABASE_URL")
    tgt_url = os.environ.get("TARGET_DATABASE_URL")
    if not src_url or not tgt_url:
        log("ERROR: set SOURCE_DATABASE_URL and TARGET_DATABASE_URL")
        return 2
    log("connecting source…")
    src = connect(src_url)
    log("connecting target…")
    tgt = connect(tgt_url)
    try:
        if args.dry_run:
            dry_run_counts(src)
            return 0
        if args.truncate_first:
            truncate_target(tgt)
        t0 = time.time()
        n1 = migrate_course_certificates(src, tgt)
        log(f"CourseCertificate rows upserted: {n1}")
        n2 = migrate_education_certificates(src, tgt)
        log(f"EducationCertificate rows upserted: {n2}")
        n3 = migrate_quests(src, tgt)
        log(f"QuestInstance rows upserted: {n3}")
        migrate_questionnaires(src, tgt)
        log("Questionnaire graph migrated")
        set_sequences(tgt)
        log(f"done duration_sec={time.time() - t0:.2f}")
    finally:
        src.close()
        tgt.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
