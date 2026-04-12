#!/usr/bin/env python3
"""
ETL: speakasap-portal (language_tests, user_tests) -> speakasap_assessment_db.
Does not touch teacher_tests or certification tables.

Env (monorepo `speakasap/.env`): ASSESSMENT_SOURCE_DATABASE_URL / ASSESSMENT_TARGET_DATABASE_URL (preferred), or SOURCE_DATABASE_URL / TARGET_DATABASE_URL
Options: --dry-run, --truncate-first
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
    print("pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


def log(msg: str) -> None:
    print(f"{datetime.now(timezone.utc).isoformat()} {msg}", flush=True)


def connect(url: str):
    return psycopg2.connect(url, connect_timeout=30)


def dry_run_counts(src) -> None:
    cur = src.cursor()
    for t in (
        "language_tests_languagetest",
        "language_tests_level",
        "language_tests_question",
        "language_tests_answer",
        "language_tests_usertest",
        "language_tests_usertestquestion",
        "user_tests_usertest",
    ):
        cur.execute("SELECT COUNT(*) FROM {}".format(t))
        log(f"dry-run {t}={cur.fetchone()[0]}")
    cur.close()


def truncate_target(tgt) -> None:
    cur = tgt.cursor()
    for s in (
        'DELETE FROM "LanguageUserTestQuestionAnswer"',
        'DELETE FROM "LanguageUserTestResult"',
        'DELETE FROM "LanguageUserTestQuestion"',
        'DELETE FROM "LanguageUserTest"',
        'DELETE FROM "LanguageAnswer"',
        'DELETE FROM "LanguageQuestion"',
        'DELETE FROM "LevelRecommendation"',
        'DELETE FROM "LanguageTest"',
        'DELETE FROM "Level"',
        'DELETE FROM "AssetUserTest"',
    ):
        cur.execute(s)
    tgt.commit()
    cur.close()


def migrate_levels(src, tgt) -> int:
    s = src.cursor()
    t = tgt.cursor()
    s.execute("SELECT id, name, difficult FROM language_tests_level ORDER BY id")
    n = 0
    for lid, name, diff in s.fetchall():
        t.execute(
            'INSERT INTO "Level" ("id", "name", "difficult") VALUES (%s, %s, %s) '
            'ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "difficult" = EXCLUDED."difficult"',
            (lid, name, diff),
        )
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n


def migrate_language_tests(src, tgt) -> int:
    sql = """
    SELECT lt.id, lt.name, lt.tag, lt.language_id, l.code, l.name
      FROM language_tests_languagetest lt
      JOIN language_language l ON l.id = lt.language_id
     ORDER BY lt.id
    """
    ins = """
    INSERT INTO "LanguageTest" ("id", "name", "tag", "languageId", "languageCode", "languageName")
    VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "tag" = EXCLUDED."tag",
      "languageId" = EXCLUDED."languageId",
      "languageCode" = EXCLUDED."languageCode",
      "languageName" = EXCLUDED."languageName"
    """
    s = src.cursor()
    t = tgt.cursor()
    s.execute(sql)
    n = 0
    for row in s.fetchall():
        t.execute(ins, row)
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n


def migrate_level_recommendations(src, tgt) -> int:
    sql = """
    SELECT lr.id, lr.level_id, lr.language_id, lr.title, lr.description, lr.link
      FROM language_tests_levelrecommendation lr
     ORDER BY lr.id
    """
    ins = """
    INSERT INTO "LevelRecommendation" ("id", "levelId", "languageId", "title", "description", "link")
    VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT ("id") DO UPDATE SET
      "levelId" = EXCLUDED."levelId",
      "languageId" = EXCLUDED."languageId",
      "title" = EXCLUDED."title",
      "description" = EXCLUDED."description",
      "link" = EXCLUDED."link"
    """
    s = src.cursor()
    t = tgt.cursor()
    s.execute(sql)
    n = 0
    for r in s.fetchall():
        t.execute(ins, r)
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n


def migrate_questions_answers(src, tgt):
    s = src.cursor()
    t = tgt.cursor()
    s.execute(
        "SELECT id, test_id, level_id, text, trashed FROM language_tests_question ORDER BY id"
    )
    nq = 0
    for qid, test_id, level_id, text, trashed in s.fetchall():
        t.execute(
            'INSERT INTO "LanguageQuestion" ("id", "testId", "levelId", "text", "isTrashed") '
            'VALUES (%s, %s, %s, %s, %s) ON CONFLICT ("id") DO UPDATE SET '
            '"text" = EXCLUDED."text", "isTrashed" = EXCLUDED."isTrashed"',
            (qid, test_id, level_id, text, bool(trashed)),
        )
        nq += 1
    tgt.commit()
    s.execute("SELECT id, question_id, text, \"right\", trashed FROM language_tests_answer ORDER BY id")
    na = 0
    for row in s.fetchall():
        aid, qid, text, right, trashed = row
        t.execute(
            'INSERT INTO "LanguageAnswer" ("id", "questionId", "text", "isCorrect", "isTrashed") '
            'VALUES (%s, %s, %s, %s, %s) ON CONFLICT ("id") DO UPDATE SET '
            '"text" = EXCLUDED."text", "isCorrect" = EXCLUDED."isCorrect", "isTrashed" = EXCLUDED."isTrashed"',
            (aid, qid, text, bool(right), bool(trashed)),
        )
        na += 1
    tgt.commit()
    s.close()
    t.close()
    return nq, na


def migrate_user_tests(src, tgt) -> int:
    sql = """
    SELECT ut.id, ut.test_id, ut.user_id::text, ut.created, ut.ended
      FROM language_tests_usertest ut ORDER BY ut.id
    """
    ins = """
    INSERT INTO "LanguageUserTest" ("id", "testId", "userId", "createdAt", "endedAt")
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT ("id") DO UPDATE SET "endedAt" = EXCLUDED."endedAt"
    """
    s = src.cursor()
    t = tgt.cursor()
    s.execute(sql)
    n = 0
    for r in s.fetchall():
        t.execute(ins, r)
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n


def migrate_user_test_questions(src, tgt) -> int:
    sql = """
    SELECT utq.id, utq.user_test_id, utq.question_id, utq.complete, utq.created
      FROM language_tests_usertestquestion utq ORDER BY utq.id
    """
    ins = """
    INSERT INTO "LanguageUserTestQuestion" ("id", "userTestId", "questionId", "isComplete", "createdAt")
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT ("id") DO UPDATE SET "isComplete" = EXCLUDED."isComplete"
    """
    s = src.cursor()
    t = tgt.cursor()
    s.execute(sql)
    n = 0
    for r in s.fetchall():
        t.execute(ins, r)
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n


def migrate_utq_answers(src, tgt) -> int:
    """M2M usertestquestion -> answer. Django table name may vary; adjust if inspect fails."""
    s = src.cursor()
    t = tgt.cursor()
    m2m = "language_tests_usertestquestion_answers"
    try:
        s.execute(
            "SELECT usertestquestion_id, answer_id FROM {} ORDER BY usertestquestion_id, answer_id".format(m2m)
        )
    except Exception:
        log(f"ERROR: could not read {m2m}; confirm Django M2M table name (\\dt *usertestquestion* in psql)")
        s.close()
        t.close()
        raise
    rows = s.fetchall()
    ins = (
        'INSERT INTO "LanguageUserTestQuestionAnswer" ("userTestQuestionId", "answerId") '
        "VALUES (%s, %s) ON CONFLICT (\"userTestQuestionId\", \"answerId\") DO NOTHING"
    )
    psycopg2.extras.execute_batch(t, ins, rows, page_size=2000)
    tgt.commit()
    n = len(rows)
    s.close()
    t.close()
    return n


def migrate_user_test_results(src, tgt) -> int:
    sql = """
    SELECT utr.user_test_id, utr.score, utr.level_id
      FROM language_tests_usertestresult utr
    """
    ins = """
    INSERT INTO "LanguageUserTestResult" ("userTestId", "score", "levelId")
    VALUES (%s, %s, %s)
    ON CONFLICT ("userTestId") DO UPDATE SET "score" = EXCLUDED."score", "levelId" = EXCLUDED."levelId"
    """
    s = src.cursor()
    t = tgt.cursor()
    s.execute(sql)
    n = 0
    for r in s.fetchall():
        t.execute(ins, r)
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n


def migrate_asset_user_tests(src, tgt) -> int:
    sql = """
    SELECT ut.uuid::text, ut.user_id::text, ut.asset, ut.questions, ut.answers,
           ut.due_date, ut.completed, ut.errors, ut.created
      FROM user_tests_usertest ut
    """
    ins = """
    INSERT INTO "AssetUserTest" ("id", "userId", "asset", "questions", "answers", "errors", "dueDate", "completedAt", "createdAt")
    VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT ("id") DO UPDATE SET
      "answers" = EXCLUDED."answers",
      "completedAt" = EXCLUDED."completedAt",
      "errors" = EXCLUDED."errors"
    """
    s = src.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    t = tgt.cursor()
    s.execute(sql)
    n = 0
    for r in s.fetchall():
        qj = r["questions"]
        aj = r["answers"]
        errs = r["errors"] or []
        t.execute(
            ins,
            (
                r["uuid"],
                r["user_id"],
                r["asset"],
                psycopg2.extras.Json(qj if isinstance(qj, dict) else json.loads(qj or "{}")),
                psycopg2.extras.Json(aj if isinstance(aj, dict) else json.loads(aj or "{}")),
                errs,
                r["due_date"],
                r["completed"],
                r["created"],
            ),
        )
        n += 1
    tgt.commit()
    s.close()
    t.close()
    return n


def set_sequences(tgt) -> None:
    cur = tgt.cursor()
    for table, col in (
        ("Level", "id"),
        ("LanguageTest", "id"),
        ("LevelRecommendation", "id"),
        ("LanguageQuestion", "id"),
        ("LanguageAnswer", "id"),
        ("LanguageUserTest", "id"),
        ("LanguageUserTestQuestion", "id"),
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
    src_url = os.environ.get("ASSESSMENT_SOURCE_DATABASE_URL") or os.environ.get("SOURCE_DATABASE_URL")
    tgt_url = os.environ.get("ASSESSMENT_TARGET_DATABASE_URL") or os.environ.get("TARGET_DATABASE_URL")
    if not src_url or not tgt_url:
        log("ERROR: set ASSESSMENT_SOURCE_DATABASE_URL and ASSESSMENT_TARGET_DATABASE_URL (or SOURCE_DATABASE_URL and TARGET_DATABASE_URL)")
        return 2
    src = connect(src_url)
    tgt = connect(tgt_url)
    try:
        if args.dry_run:
            dry_run_counts(src)
            return 0
        if args.truncate_first:
            truncate_target(tgt)
        t0 = time.time()
        log(f"levels={migrate_levels(src, tgt)}")
        log(f"languageTests={migrate_language_tests(src, tgt)}")
        log(f"levelRecommendations={migrate_level_recommendations(src, tgt)}")
        nq, na = migrate_questions_answers(src, tgt)
        log(f"languageQuestions={nq} languageAnswers={na}")
        log(f"languageUserTests={migrate_user_tests(src, tgt)}")
        log(f"languageUserTestQuestions={migrate_user_test_questions(src, tgt)}")
        log(f"languageUserTestQuestionAnswer={migrate_utq_answers(src, tgt)}")
        log(f"languageUserTestResults={migrate_user_test_results(src, tgt)}")
        log(f"assetUserTests={migrate_asset_user_tests(src, tgt)}")
        set_sequences(tgt)
        log(f"done sec={time.time() - t0:.2f}")
    finally:
        src.close()
        tgt.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
