#!/usr/bin/env python
"""
Content Service Data Migration Script

Migrates content data from legacy Django database to new Prisma database.
Uses Django ORM to read legacy data and psycopg2 to write to new database.

Modes:
  (default) Live: Django reads legacy DB, psycopg2 writes target (same host needs both DBs).
  --export-dir DIR   Django only: write JSON snapshot to DIR (copy DIR elsewhere).
  --import-dir DIR   psycopg2 only: load snapshot into target DB (no Django).

Usage:
    python migrate-content-data.py [--dry-run] [--new-db-url URL]
    python migrate-content-data.py --export-dir /tmp/speakasap-content-export
    python migrate-content-data.py --import-dir ./speakasap-content-export [--truncate-first]

Environment Variables:
    DATABASE_URL or NEW_DATABASE_URL - Target Prisma Postgres URL (live / import)
    SPEAKASAP_PORTAL_ROOT - Optional path to speakasap-portal (default: sibling of repo root)

Legacy DB: configured by speakasap-portal (portal/local_settings / .env), not this script.
"""

import argparse
import io
import json
import logging
import os
import sys
from datetime import datetime

EXPORT_FORMAT_VERSION = 1

EXPORT_FILES = (
    'languages.json',
    'grammar_courses.json',
    'grammar_lessons.json',
    'phonetics_courses.json',
    'phonetics_lessons.json',
    'songs_courses.json',
    'songs_lessons.json',
    'words.json',
    'word_themes.json',
    'word_theme_relations.json',
)

# Populated by _ensure_django()
LegacyLanguage = None
LegacyGrammarCourse = None
LegacyGrammarLesson = None
LegacyPhoneticsCourse = None
LegacyPhoneticsLesson = None
LegacySongsCourse = None
LegacySongsLesson = None
LegacyWord = None
LegacyWordTheme = None
LegacyWordThemeRelation = None


def _bootstrap_django():
    """Add portal to sys.path and set DJANGO_SETTINGS_MODULE before django.setup()."""
    portal_root = os.environ.get('SPEAKASAP_PORTAL_ROOT')
    if not portal_root:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        portal_root = os.path.abspath(
            os.path.join(script_dir, '..', '..', '..', 'speakasap-portal')
        )
    if os.path.isdir(portal_root) and portal_root not in sys.path:
        sys.path.insert(0, portal_root)
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'portal.settings')


def _ensure_django():
    global LegacyLanguage, LegacyGrammarCourse, LegacyGrammarLesson
    global LegacyPhoneticsCourse, LegacyPhoneticsLesson
    global LegacySongsCourse, LegacySongsLesson
    global LegacyWord, LegacyWordTheme, LegacyWordThemeRelation
    if LegacyLanguage is not None:
        return
    _bootstrap_django()
    import django
    django.setup()
    from language.models import Language as _LL
    from grammar.models import GrammarCourse as _LGC, GrammarLesson as _LGL
    from phonetics.models import PhoneticsCourse as _LPC, PhoneticsLesson as _LPL
    from songs.models import SongsCourse as _LSC, SongsLesson as _LSL
    from dictionary.models import Word as _LW, WordTheme as _LWT, WordThemeRelation as _LWTR
    LegacyLanguage = _LL
    LegacyGrammarCourse = _LGC
    LegacyGrammarLesson = _LGL
    LegacyPhoneticsCourse = _LPC
    LegacyPhoneticsLesson = _LPL
    LegacySongsCourse = _LSC
    LegacySongsLesson = _LSL
    LegacyWord = _LW
    LegacyWordTheme = _LWT
    LegacyWordThemeRelation = _LWTR


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# stats dict keys -> Prisma public table names (for post-migration COUNT)
STAT_KEY_TO_PRISMA_TABLE = {
    'languages': 'Language',
    'grammar_courses': 'GrammarCourse',
    'grammar_lessons': 'GrammarLesson',
    'phonetics_courses': 'PhoneticsCourse',
    'phonetics_lessons': 'PhoneticsLesson',
    'songs_courses': 'SongsCourse',
    'songs_lessons': 'SongsLesson',
    'words': 'Word',
    'word_themes': 'WordTheme',
    'word_theme_relations': 'WordThemeRelation',
}


def _write_json(path, obj):
    with io.open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


def _read_json(path):
    with io.open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def run_export(export_dir):
    """Dump legacy ORM data to JSON files (no target database)."""
    _ensure_django()
    if os.path.exists(export_dir) and not os.path.isdir(export_dir):
        logger.error("Export path exists and is not a directory: %s", export_dir)
        return 1
    if not os.path.isdir(export_dir):
        os.makedirs(export_dir)

    manifest = {
        'format_version': EXPORT_FORMAT_VERSION,
        'exported_at': datetime.now().isoformat(),
    }
    _write_json(os.path.join(export_dir, 'manifest.json'), manifest)

    langs = []
    for lang in LegacyLanguage.objects.all().order_by('id'):
        icon_path = str(lang.icon) if lang.icon else ''
        langs.append({
            'legacy_id': lang.id,
            'code': lang.code,
            'machineName': lang.machine_name,
            'name': lang.name,
            'iconPath': icon_path,
            'order': lang.order,
            'speaker': lang.speaker or 'носитель',
        })
    _write_json(os.path.join(export_dir, 'languages.json'), langs)
    logger.info("Exported %s languages", len(langs))

    gc = []
    for course in LegacyGrammarCourse.objects.all().order_by('id'):
        gc.append({
            'legacy_id': course.id,
            'legacy_language_id': course.language_id,
            'title': course.title,
            'materialLanguage': course.material_language or 'ru',
            'metaKeywords': course.meta_keywords or None,
            'metaDescription': course.meta_description or None,
        })
    _write_json(os.path.join(export_dir, 'grammar_courses.json'), gc)
    logger.info("Exported %s grammar courses", len(gc))

    gl = []
    for lesson in LegacyGrammarLesson.objects.all().order_by('id'):
        gl.append({
            'legacy_id': lesson.id,
            'legacy_course_id': lesson.course_id,
            'title': lesson.title,
            'template': lesson.template,
            'alias': lesson.alias or None,
            'url': lesson.url,
            'section': lesson.section or None,
            'teaser': lesson.teaser or None,
            'order': lesson.order or 0,
            'metaKeywords': lesson.meta_keywords or None,
            'metaDescription': lesson.meta_description or None,
        })
    _write_json(os.path.join(export_dir, 'grammar_lessons.json'), gl)
    logger.info("Exported %s grammar lessons", len(gl))

    pc = []
    for course in LegacyPhoneticsCourse.objects.all().order_by('id'):
        pc.append({
            'legacy_id': course.id,
            'legacy_language_id': course.language_id,
            'title': course.title,
            'materialLanguage': course.material_language or 'ru',
            'metaKeywords': course.meta_keywords or None,
            'metaDescription': course.meta_description or None,
        })
    _write_json(os.path.join(export_dir, 'phonetics_courses.json'), pc)
    logger.info("Exported %s phonetics courses", len(pc))

    pl = []
    for lesson in LegacyPhoneticsLesson.objects.all().order_by('id'):
        pl.append({
            'legacy_id': lesson.id,
            'legacy_course_id': lesson.course_id,
            'title': lesson.title,
            'order': lesson.order,
            'metaKeywords': lesson.meta_keywords or None,
            'metaDescription': lesson.meta_description or None,
        })
    _write_json(os.path.join(export_dir, 'phonetics_lessons.json'), pl)
    logger.info("Exported %s phonetics lessons", len(pl))

    sc = []
    for course in LegacySongsCourse.objects.all().order_by('id'):
        sc.append({
            'legacy_id': course.id,
            'legacy_language_id': course.language_id,
            'title': course.title,
            'materialLanguage': course.material_language or 'ru',
        })
    _write_json(os.path.join(export_dir, 'songs_courses.json'), sc)
    logger.info("Exported %s songs courses", len(sc))

    sl = []
    for lesson in LegacySongsLesson.objects.all().order_by('id'):
        sl.append({
            'legacy_id': lesson.id,
            'legacy_course_id': lesson.course_id,
            'title': lesson.title,
            'order': lesson.order,
        })
    _write_json(os.path.join(export_dir, 'songs_lessons.json'), sl)
    logger.info("Exported %s songs lessons", len(sl))

    words = []
    for word in LegacyWord.objects.all().order_by('id'):
        words.append({
            'legacy_id': word.id,
            'legacy_language_id': word.language_id,
            'word': word.word,
            'transcription': word.transcription or None,
            'translation': word.translation or None,
        })
    _write_json(os.path.join(export_dir, 'words.json'), words)
    logger.info("Exported %s words", len(words))

    themes = []
    for theme in LegacyWordTheme.objects.all().order_by('id'):
        themes.append({
            'legacy_id': theme.id,
            'name': theme.name,
            'moduleClass': theme.module_class or '',
            'order': theme.order or 0,
        })
    _write_json(os.path.join(export_dir, 'word_themes.json'), themes)
    logger.info("Exported %s word themes", len(themes))

    rels = []
    for relation in LegacyWordThemeRelation.objects.all().order_by('id'):
        rels.append({
            'legacy_id': relation.id,
            'legacy_word_id': relation.word_id,
            'legacy_theme_id': relation.theme_id,
            'order': relation.order or 0,
        })
    _write_json(os.path.join(export_dir, 'word_theme_relations.json'), rels)
    logger.info("Exported %s word theme relations", len(rels))

    logger.info("Export complete: %s", export_dir)
    return 0


def run_import(export_dir, new_db_url, truncate_first):
    """Load JSON snapshot into Prisma Postgres (no Django)."""
    import psycopg2

    manifest_path = os.path.join(export_dir, 'manifest.json')
    if not os.path.isfile(manifest_path):
        logger.error("Missing manifest.json in %s", export_dir)
        return 1
    manifest = _read_json(manifest_path)
    if manifest.get('format_version') != EXPORT_FORMAT_VERSION:
        logger.error(
            "Unsupported format_version %s (expected %s)",
            manifest.get('format_version'),
            EXPORT_FORMAT_VERSION,
        )
        return 1

    for name in EXPORT_FILES:
        p = os.path.join(export_dir, name)
        if not os.path.isfile(p):
            logger.error("Missing export file: %s", p)
            return 1

    new_db_url = new_db_url or os.getenv('DATABASE_URL') or os.getenv('NEW_DATABASE_URL')
    if not new_db_url:
        logger.error("NEW_DATABASE_URL or DATABASE_URL required for import")
        return 1

    conn = psycopg2.connect(new_db_url)
    conn.autocommit = False

    stats = {
        'languages': {'legacy': 0, 'new': 0},
        'grammar_courses': {'legacy': 0, 'new': 0},
        'grammar_lessons': {'legacy': 0, 'new': 0},
        'phonetics_courses': {'legacy': 0, 'new': 0},
        'phonetics_lessons': {'legacy': 0, 'new': 0},
        'songs_courses': {'legacy': 0, 'new': 0},
        'songs_lessons': {'legacy': 0, 'new': 0},
        'words': {'legacy': 0, 'new': 0},
        'word_themes': {'legacy': 0, 'new': 0},
        'word_theme_relations': {'legacy': 0, 'new': 0},
    }

    try:
        cursor = conn.cursor()
        if truncate_first:
            logger.info("Truncating content tables (RESTART IDENTITY CASCADE)")
            cursor.execute(
                'TRUNCATE "WordThemeRelation", "Word", "WordTheme", '
                '"SongsLesson", "SongsCourse", "PhoneticsLesson", "PhoneticsCourse", '
                '"GrammarLesson", "GrammarCourse", "Language" '
                'RESTART IDENTITY CASCADE'
            )
            conn.commit()

        langs = _read_json(os.path.join(export_dir, 'languages.json'))
        stats['languages']['legacy'] = len(langs)
        language_id_mapping = {}
        for row in langs:
            cursor.execute(
                """
                INSERT INTO "Language" (code, "machineName", name, "iconPath", "order", speaker)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    row['code'],
                    row['machineName'],
                    row['name'],
                    row['iconPath'],
                    row['order'],
                    row['speaker'],
                ),
            )
            new_id = cursor.fetchone()[0]
            language_id_mapping[row['legacy_id']] = new_id
        stats['languages']['new'] = len(language_id_mapping)
        logger.info("Prepared %s languages (commit at end)", stats['languages']['new'])

        gc_rows = _read_json(os.path.join(export_dir, 'grammar_courses.json'))
        stats['grammar_courses']['legacy'] = len(gc_rows)
        grammar_course_id_mapping = {}
        for row in gc_rows:
            lid = row['legacy_language_id']
            if lid not in language_id_mapping:
                logger.warning(
                    "Skipping grammar course legacy_id=%s: language %s missing",
                    row['legacy_id'], lid,
                )
                continue
            cursor.execute(
                """
                INSERT INTO "GrammarCourse" (
                    title, "materialLanguage", "metaKeywords", "metaDescription", "languageId"
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    row['title'],
                    row['materialLanguage'],
                    row['metaKeywords'],
                    row['metaDescription'],
                    language_id_mapping[lid],
                ),
            )
            grammar_course_id_mapping[row['legacy_id']] = cursor.fetchone()[0]
        stats['grammar_courses']['new'] = len(grammar_course_id_mapping)
        logger.info("Prepared %s grammar courses", stats['grammar_courses']['new'])

        pc_rows = _read_json(os.path.join(export_dir, 'phonetics_courses.json'))
        stats['phonetics_courses']['legacy'] = len(pc_rows)
        phonetics_course_id_mapping = {}
        for row in pc_rows:
            lid = row['legacy_language_id']
            if lid not in language_id_mapping:
                logger.warning(
                    "Skipping phonetics course legacy_id=%s: language %s missing",
                    row['legacy_id'], lid,
                )
                continue
            cursor.execute(
                """
                INSERT INTO "PhoneticsCourse" (
                    title, "materialLanguage", "metaKeywords", "metaDescription", "languageId"
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    row['title'],
                    row['materialLanguage'],
                    row['metaKeywords'],
                    row['metaDescription'],
                    language_id_mapping[lid],
                ),
            )
            phonetics_course_id_mapping[row['legacy_id']] = cursor.fetchone()[0]
        stats['phonetics_courses']['new'] = len(phonetics_course_id_mapping)
        logger.info("Prepared %s phonetics courses", stats['phonetics_courses']['new'])

        sc_rows = _read_json(os.path.join(export_dir, 'songs_courses.json'))
        stats['songs_courses']['legacy'] = len(sc_rows)
        songs_course_id_mapping = {}
        for row in sc_rows:
            lid = row['legacy_language_id']
            if lid not in language_id_mapping:
                logger.warning(
                    "Skipping songs course legacy_id=%s: language %s missing",
                    row['legacy_id'], lid,
                )
                continue
            cursor.execute(
                """
                INSERT INTO "SongsCourse" (title, "materialLanguage", "languageId")
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (
                    row['title'],
                    row['materialLanguage'],
                    language_id_mapping[lid],
                ),
            )
            songs_course_id_mapping[row['legacy_id']] = cursor.fetchone()[0]
        stats['songs_courses']['new'] = len(songs_course_id_mapping)
        logger.info("Prepared %s songs courses", stats['songs_courses']['new'])

        gl_rows = _read_json(os.path.join(export_dir, 'grammar_lessons.json'))
        stats['grammar_lessons']['legacy'] = len(gl_rows)
        g_count = 0
        for row in gl_rows:
            cid = row['legacy_course_id']
            if cid not in grammar_course_id_mapping:
                logger.warning(
                    "Skipping grammar lesson legacy_id=%s: course %s missing",
                    row['legacy_id'], cid,
                )
                continue
            cursor.execute(
                """
                INSERT INTO "GrammarLesson" (
                    title, "courseId", template, alias, url, section, teaser, "order",
                    "metaKeywords", "metaDescription"
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    row['title'],
                    grammar_course_id_mapping[cid],
                    row['template'],
                    row['alias'],
                    row['url'],
                    row['section'],
                    row['teaser'],
                    row['order'],
                    row['metaKeywords'],
                    row['metaDescription'],
                ),
            )
            g_count += 1
            if g_count % 100 == 0:
                logger.info("Imported %s grammar lessons...", g_count)
        stats['grammar_lessons']['new'] = g_count
        logger.info("Prepared %s grammar lessons", g_count)

        pl_rows = _read_json(os.path.join(export_dir, 'phonetics_lessons.json'))
        stats['phonetics_lessons']['legacy'] = len(pl_rows)
        p_count = 0
        for row in pl_rows:
            cid = row['legacy_course_id']
            if cid not in phonetics_course_id_mapping:
                logger.warning(
                    "Skipping phonetics lesson legacy_id=%s: course %s missing",
                    row['legacy_id'], cid,
                )
                continue
            cursor.execute(
                """
                INSERT INTO "PhoneticsLesson" (
                    title, "courseId", "order", "metaKeywords", "metaDescription"
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    row['title'],
                    phonetics_course_id_mapping[cid],
                    row['order'],
                    row['metaKeywords'],
                    row['metaDescription'],
                ),
            )
            p_count += 1
        stats['phonetics_lessons']['new'] = p_count
        logger.info("Prepared %s phonetics lessons", p_count)

        sl_rows = _read_json(os.path.join(export_dir, 'songs_lessons.json'))
        stats['songs_lessons']['legacy'] = len(sl_rows)
        s_count = 0
        for row in sl_rows:
            cid = row['legacy_course_id']
            if cid not in songs_course_id_mapping:
                logger.warning(
                    "Skipping songs lesson legacy_id=%s: course %s missing",
                    row['legacy_id'], cid,
                )
                continue
            cursor.execute(
                """
                INSERT INTO "SongsLesson" (title, "courseId", "order")
                VALUES (%s, %s, %s)
                """,
                (
                    row['title'],
                    songs_course_id_mapping[cid],
                    row['order'],
                ),
            )
            s_count += 1
        stats['songs_lessons']['new'] = s_count
        logger.info("Prepared %s songs lessons", s_count)

        word_rows = _read_json(os.path.join(export_dir, 'words.json'))
        stats['words']['legacy'] = len(word_rows)
        word_id_mapping = {}
        w_skip = 0
        for row in word_rows:
            lid = row['legacy_language_id']
            if lid not in language_id_mapping:
                w_skip += 1
                continue
            new_lang_id = language_id_mapping[lid]
            cursor.execute('SAVEPOINT migrate_word_row')
            try:
                cursor.execute(
                    """
                    INSERT INTO "Word" (word, transcription, translation, "languageId")
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        row['word'],
                        row['transcription'],
                        row['translation'],
                        new_lang_id,
                    ),
                )
                new_id = cursor.fetchone()[0]
                word_id_mapping[row['legacy_id']] = new_id
                cursor.execute('RELEASE SAVEPOINT migrate_word_row')
            except psycopg2.IntegrityError:
                cursor.execute('ROLLBACK TO SAVEPOINT migrate_word_row')
                w_skip += 1
            if len(word_id_mapping) % 1000 == 0 and len(word_id_mapping) > 0:
                logger.info("Imported %s words...", len(word_id_mapping))
        stats['words']['new'] = len(word_id_mapping)
        logger.info(
            "Prepared %s words (skipped %s)",
            stats['words']['new'], w_skip,
        )

        theme_rows = _read_json(os.path.join(export_dir, 'word_themes.json'))
        stats['word_themes']['legacy'] = len(theme_rows)
        theme_id_mapping = {}
        for row in theme_rows:
            cursor.execute(
                """
                INSERT INTO "WordTheme" (name, "moduleClass", "order")
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (row['name'], row['moduleClass'], row['order']),
            )
            theme_id_mapping[row['legacy_id']] = cursor.fetchone()[0]
        stats['word_themes']['new'] = len(theme_id_mapping)
        logger.info("Prepared %s word themes", stats['word_themes']['new'])

        rel_rows = _read_json(os.path.join(export_dir, 'word_theme_relations.json'))
        stats['word_theme_relations']['legacy'] = len(rel_rows)
        r_count = 0
        r_skip = 0
        for row in rel_rows:
            wid = row['legacy_word_id']
            tid = row['legacy_theme_id']
            if wid not in word_id_mapping or tid not in theme_id_mapping:
                r_skip += 1
                continue
            cursor.execute('SAVEPOINT migrate_wtr_row')
            try:
                cursor.execute(
                    """
                    INSERT INTO "WordThemeRelation" ("wordId", "themeId", "order")
                    VALUES (%s, %s, %s)
                    """,
                    (
                        word_id_mapping[wid],
                        theme_id_mapping[tid],
                        row['order'],
                    ),
                )
                r_count += 1
                cursor.execute('RELEASE SAVEPOINT migrate_wtr_row')
            except psycopg2.IntegrityError:
                cursor.execute('ROLLBACK TO SAVEPOINT migrate_wtr_row')
                r_skip += 1
            if r_count % 1000 == 0 and r_count > 0:
                logger.info("Imported %s word theme relations...", r_count)
        stats['word_theme_relations']['new'] = r_count
        logger.info(
            "Prepared %s word theme relations (skipped %s)",
            r_count, r_skip,
        )

        conn.commit()
        logger.info("Committed full content load (single transaction)")

        for stat_key, st in stats.items():
            prisma_table = STAT_KEY_TO_PRISMA_TABLE.get(stat_key)
            if not prisma_table:
                continue
            cursor.execute('SELECT COUNT(*) FROM "{}"'.format(prisma_table))
            new_count = cursor.fetchone()[0]
            st['new'] = new_count
            legacy_count = st['legacy']
            status = 'OK' if legacy_count == new_count else 'MISMATCH'
            logger.info(
                "%s %s (%s): legacy=%s, new=%s",
                status, stat_key, prisma_table, legacy_count, new_count,
            )

        logger.info("Import completed successfully")
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


class ContentDataMigrator(object):
    """Migrates content data from legacy Django database to new Prisma database."""

    def __init__(self, new_db_url=None, dry_run=False):
        import psycopg2

        self.dry_run = dry_run
        self.stats = {
            'languages': {'legacy': 0, 'new': 0},
            'grammar_courses': {'legacy': 0, 'new': 0},
            'grammar_lessons': {'legacy': 0, 'new': 0},
            'phonetics_courses': {'legacy': 0, 'new': 0},
            'phonetics_lessons': {'legacy': 0, 'new': 0},
            'songs_courses': {'legacy': 0, 'new': 0},
            'songs_lessons': {'legacy': 0, 'new': 0},
            'words': {'legacy': 0, 'new': 0},
            'word_themes': {'legacy': 0, 'new': 0},
            'word_theme_relations': {'legacy': 0, 'new': 0},
        }
        self.errors = []
        self.start_time = datetime.now()

        if not dry_run:
            new_db_url = new_db_url or os.getenv('DATABASE_URL') or os.getenv('NEW_DATABASE_URL')
            if not new_db_url:
                raise ValueError("NEW_DATABASE_URL or DATABASE_URL environment variable required")
            self.new_conn = psycopg2.connect(new_db_url)
            self.new_conn.autocommit = False
            logger.info("Connected to new database")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if hasattr(self, 'new_conn') and not self.dry_run:
            self.new_conn.close()
            logger.info("Closed new database connection")

    def log_error(self, message, exception=None):
        error_msg = "{}: {}".format(message, exception) if exception else message
        logger.error(error_msg)
        self.errors.append(error_msg)
        if exception:
            logger.exception(exception)

    def migrate_languages(self):
        _ensure_django()
        logger.info("=" * 60)
        logger.info("Migrating Languages")
        logger.info("=" * 60)

        legacy_languages = LegacyLanguage.objects.all().order_by('id')
        self.stats['languages']['legacy'] = legacy_languages.count()
        logger.info("Found {} languages in legacy database".format(self.stats['languages']['legacy']))

        id_mapping = {}
        if self.dry_run:
            logger.info("DRY RUN: Would migrate languages")
            return id_mapping

        try:
            cursor = self.new_conn.cursor()
            for lang in legacy_languages:
                icon_path = str(lang.icon) if lang.icon else ''

                cursor.execute(
                    """
                    INSERT INTO "Language" (code, "machineName", name, "iconPath", "order", speaker)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        lang.code,
                        lang.machine_name,
                        lang.name,
                        icon_path,
                        lang.order,
                        lang.speaker or 'носитель'
                    ),
                )
                new_id = cursor.fetchone()[0]
                id_mapping[lang.id] = new_id
                logger.debug(
                    "Migrated language: %s (legacy_id=%s -> new_id=%s)",
                    lang.code, lang.id, new_id,
                )

            self.new_conn.commit()
            self.stats['languages']['new'] = len(id_mapping)
            logger.info("Successfully migrated {} languages".format(self.stats['languages']['new']))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate languages", e)
            raise

    def migrate_grammar_courses(self, language_id_mapping):
        _ensure_django()
        logger.info("=" * 60)
        logger.info("Migrating Grammar Courses")
        logger.info("=" * 60)

        legacy_courses = LegacyGrammarCourse.objects.all().order_by('id')
        self.stats['grammar_courses']['legacy'] = legacy_courses.count()
        logger.info("Found {} grammar courses in legacy database".format(self.stats['grammar_courses']['legacy']))

        id_mapping = {}
        if self.dry_run:
            logger.info("DRY RUN: Would migrate grammar courses")
            return id_mapping

        try:
            cursor = self.new_conn.cursor()
            for course in legacy_courses:
                if course.language_id not in language_id_mapping:
                    logger.warning(
                        "Skipping grammar course %s: language_id %s not in mapping",
                        course.id, course.language_id,
                    )
                    continue

                new_language_id = language_id_mapping[course.language_id]
                cursor.execute(
                    """
                    INSERT INTO "GrammarCourse" (
                        title, "materialLanguage", "metaKeywords", "metaDescription", "languageId"
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        course.title,
                        course.material_language or 'ru',
                        course.meta_keywords or None,
                        course.meta_description or None,
                        new_language_id
                    ),
                )
                new_id = cursor.fetchone()[0]
                id_mapping[course.id] = new_id
                logger.debug(
                    "Migrated grammar course: %s (legacy_id=%s -> new_id=%s)",
                    course.title, course.id, new_id,
                )

            self.new_conn.commit()
            self.stats['grammar_courses']['new'] = len(id_mapping)
            logger.info("Successfully migrated {} grammar courses".format(self.stats['grammar_courses']['new']))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate grammar courses", e)
            raise

    def migrate_grammar_lessons(self, course_id_mapping):
        _ensure_django()
        logger.info("=" * 60)
        logger.info("Migrating Grammar Lessons")
        logger.info("=" * 60)

        legacy_lessons = LegacyGrammarLesson.objects.all().order_by('id')
        self.stats['grammar_lessons']['legacy'] = legacy_lessons.count()
        logger.info("Found {} grammar lessons in legacy database".format(self.stats['grammar_lessons']['legacy']))

        if self.dry_run:
            logger.info("DRY RUN: Would migrate grammar lessons")
            return

        try:
            cursor = self.new_conn.cursor()
            migrated_count = 0
            for lesson in legacy_lessons:
                if lesson.course_id not in course_id_mapping:
                    logger.warning(
                        "Skipping grammar lesson %s: course_id %s not in mapping",
                        lesson.id, lesson.course_id,
                    )
                    continue

                new_course_id = course_id_mapping[lesson.course_id]
                cursor.execute(
                    """
                    INSERT INTO "GrammarLesson" (
                        title, "courseId", template, alias, url, section, teaser, "order",
                        "metaKeywords", "metaDescription"
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        lesson.title,
                        new_course_id,
                        lesson.template,
                        lesson.alias or None,
                        lesson.url,
                        lesson.section or None,
                        lesson.teaser or None,
                        lesson.order or 0,
                        lesson.meta_keywords or None,
                        lesson.meta_description or None
                    ),
                )
                migrated_count += 1
                if migrated_count % 100 == 0:
                    logger.info("Migrated {} grammar lessons...".format(migrated_count))

            self.new_conn.commit()
            self.stats['grammar_lessons']['new'] = migrated_count
            logger.info("Successfully migrated {} grammar lessons".format(self.stats['grammar_lessons']['new']))

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate grammar lessons", e)
            raise

    def migrate_phonetics_courses(self, language_id_mapping):
        _ensure_django()
        logger.info("=" * 60)
        logger.info("Migrating Phonetics Courses")
        logger.info("=" * 60)

        legacy_courses = LegacyPhoneticsCourse.objects.all().order_by('id')
        self.stats['phonetics_courses']['legacy'] = legacy_courses.count()
        logger.info("Found {} phonetics courses in legacy database".format(self.stats['phonetics_courses']['legacy']))

        id_mapping = {}
        if self.dry_run:
            logger.info("DRY RUN: Would migrate phonetics courses")
            return id_mapping

        try:
            cursor = self.new_conn.cursor()
            for course in legacy_courses:
                if course.language_id not in language_id_mapping:
                    logger.warning(
                        "Skipping phonetics course %s: language_id %s not in mapping",
                        course.id, course.language_id,
                    )
                    continue

                new_language_id = language_id_mapping[course.language_id]
                cursor.execute(
                    """
                    INSERT INTO "PhoneticsCourse" (
                        title, "materialLanguage", "metaKeywords", "metaDescription", "languageId"
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        course.title,
                        course.material_language or 'ru',
                        course.meta_keywords or None,
                        course.meta_description or None,
                        new_language_id
                    ),
                )
                new_id = cursor.fetchone()[0]
                id_mapping[course.id] = new_id
                logger.debug(
                    "Migrated phonetics course: %s (legacy_id=%s -> new_id=%s)",
                    course.title, course.id, new_id,
                )

            self.new_conn.commit()
            self.stats['phonetics_courses']['new'] = len(id_mapping)
            logger.info("Successfully migrated {} phonetics courses".format(self.stats['phonetics_courses']['new']))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate phonetics courses", e)
            raise

    def migrate_phonetics_lessons(self, course_id_mapping):
        _ensure_django()
        logger.info("=" * 60)
        logger.info("Migrating Phonetics Lessons")
        logger.info("=" * 60)

        legacy_lessons = LegacyPhoneticsLesson.objects.all().order_by('id')
        self.stats['phonetics_lessons']['legacy'] = legacy_lessons.count()
        logger.info("Found {} phonetics lessons in legacy database".format(self.stats['phonetics_lessons']['legacy']))

        if self.dry_run:
            logger.info("DRY RUN: Would migrate phonetics lessons")
            return

        try:
            cursor = self.new_conn.cursor()
            migrated_count = 0
            for lesson in legacy_lessons:
                if lesson.course_id not in course_id_mapping:
                    logger.warning(
                        "Skipping phonetics lesson %s: course_id %s not in mapping",
                        lesson.id, lesson.course_id,
                    )
                    continue

                new_course_id = course_id_mapping[lesson.course_id]
                cursor.execute(
                    """
                    INSERT INTO "PhoneticsLesson" (
                        title, "courseId", "order", "metaKeywords", "metaDescription"
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        lesson.title,
                        new_course_id,
                        lesson.order,
                        lesson.meta_keywords or None,
                        lesson.meta_description or None
                    ),
                )
                migrated_count += 1
                if migrated_count % 100 == 0:
                    logger.info("Migrated {} phonetics lessons...".format(migrated_count))

            self.new_conn.commit()
            self.stats['phonetics_lessons']['new'] = migrated_count
            logger.info("Successfully migrated {} phonetics lessons".format(self.stats['phonetics_lessons']['new']))

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate phonetics lessons", e)
            raise

    def migrate_songs_courses(self, language_id_mapping):
        _ensure_django()
        logger.info("=" * 60)
        logger.info("Migrating Songs Courses")
        logger.info("=" * 60)

        legacy_courses = LegacySongsCourse.objects.all().order_by('id')
        self.stats['songs_courses']['legacy'] = legacy_courses.count()
        logger.info("Found {} songs courses in legacy database".format(self.stats['songs_courses']['legacy']))

        id_mapping = {}
        if self.dry_run:
            logger.info("DRY RUN: Would migrate songs courses")
            return id_mapping

        try:
            cursor = self.new_conn.cursor()
            for course in legacy_courses:
                if course.language_id not in language_id_mapping:
                    logger.warning(
                        "Skipping songs course %s: language_id %s not in mapping",
                        course.id, course.language_id,
                    )
                    continue

                new_language_id = language_id_mapping[course.language_id]
                cursor.execute(
                    """
                    INSERT INTO "SongsCourse" (title, "materialLanguage", "languageId")
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (
                        course.title,
                        course.material_language or 'ru',
                        new_language_id
                    ),
                )
                new_id = cursor.fetchone()[0]
                id_mapping[course.id] = new_id
                logger.debug(
                    "Migrated songs course: %s (legacy_id=%s -> new_id=%s)",
                    course.title, course.id, new_id,
                )

            self.new_conn.commit()
            self.stats['songs_courses']['new'] = len(id_mapping)
            logger.info("Successfully migrated {} songs courses".format(self.stats['songs_courses']['new']))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate songs courses", e)
            raise

    def migrate_songs_lessons(self, course_id_mapping):
        _ensure_django()
        logger.info("=" * 60)
        logger.info("Migrating Songs Lessons")
        logger.info("=" * 60)

        legacy_lessons = LegacySongsLesson.objects.all().order_by('id')
        self.stats['songs_lessons']['legacy'] = legacy_lessons.count()
        logger.info("Found {} songs lessons in legacy database".format(self.stats['songs_lessons']['legacy']))

        if self.dry_run:
            logger.info("DRY RUN: Would migrate songs lessons")
            return

        try:
            cursor = self.new_conn.cursor()
            migrated_count = 0
            for lesson in legacy_lessons:
                if lesson.course_id not in course_id_mapping:
                    logger.warning(
                        "Skipping songs lesson %s: course_id %s not in mapping",
                        lesson.id, lesson.course_id,
                    )
                    continue

                new_course_id = course_id_mapping[lesson.course_id]
                cursor.execute(
                    """
                    INSERT INTO "SongsLesson" (title, "courseId", "order")
                    VALUES (%s, %s, %s)
                    """,
                    (
                        lesson.title,
                        new_course_id,
                        lesson.order
                    ),
                )
                migrated_count += 1
                if migrated_count % 100 == 0:
                    logger.info("Migrated {} songs lessons...".format(migrated_count))

            self.new_conn.commit()
            self.stats['songs_lessons']['new'] = migrated_count
            logger.info("Successfully migrated {} songs lessons".format(self.stats['songs_lessons']['new']))

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate songs lessons", e)
            raise

    def migrate_words(self, language_id_mapping):
        _ensure_django()
        import psycopg2

        logger.info("=" * 60)
        logger.info("Migrating Words")
        logger.info("=" * 60)

        legacy_words = LegacyWord.objects.all().order_by('id')
        self.stats['words']['legacy'] = legacy_words.count()
        logger.info("Found {} words in legacy database".format(self.stats['words']['legacy']))

        id_mapping = {}
        if self.dry_run:
            logger.info("DRY RUN: Would migrate words")
            return id_mapping

        try:
            cursor = self.new_conn.cursor()
            migrated_count = 0
            skipped_count = 0
            for word in legacy_words:
                if word.language_id not in language_id_mapping:
                    logger.warning(
                        "Skipping word %s: language_id %s not in mapping",
                        word.id, word.language_id,
                    )
                    skipped_count += 1
                    continue

                new_language_id = language_id_mapping[word.language_id]
                cursor.execute("SAVEPOINT migrate_word_row")
                try:
                    cursor.execute(
                        """
                        INSERT INTO "Word" (word, transcription, translation, "languageId")
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            word.word,
                            word.transcription or None,
                            word.translation or None,
                            new_language_id
                        ),
                    )
                    new_id = cursor.fetchone()[0]
                    id_mapping[word.id] = new_id
                    migrated_count += 1
                    cursor.execute("RELEASE SAVEPOINT migrate_word_row")
                    if migrated_count % 1000 == 0:
                        logger.info("Migrated {} words...".format(migrated_count))
                except psycopg2.IntegrityError:
                    cursor.execute("ROLLBACK TO SAVEPOINT migrate_word_row")
                    skipped_count += 1
                    logger.debug(
                        "Skipped duplicate word: %s (language_id=%s)",
                        word.word, new_language_id,
                    )

            self.new_conn.commit()
            self.stats['words']['new'] = migrated_count
            logger.info(
                "Successfully migrated %s words (skipped %s duplicates)",
                migrated_count, skipped_count,
            )
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate words", e)
            raise

    def migrate_word_themes(self):
        _ensure_django()
        logger.info("=" * 60)
        logger.info("Migrating Word Themes")
        logger.info("=" * 60)

        legacy_themes = LegacyWordTheme.objects.all().order_by('id')
        self.stats['word_themes']['legacy'] = legacy_themes.count()
        logger.info("Found {} word themes in legacy database".format(self.stats['word_themes']['legacy']))

        id_mapping = {}
        if self.dry_run:
            logger.info("DRY RUN: Would migrate word themes")
            return id_mapping

        try:
            cursor = self.new_conn.cursor()
            for theme in legacy_themes:
                cursor.execute(
                    """
                    INSERT INTO "WordTheme" (name, "moduleClass", "order")
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (
                        theme.name,
                        theme.module_class or '',
                        theme.order or 0
                    ),
                )
                new_id = cursor.fetchone()[0]
                id_mapping[theme.id] = new_id
                logger.debug(
                    "Migrated word theme: %s (legacy_id=%s -> new_id=%s)",
                    theme.name, theme.id, new_id,
                )

            self.new_conn.commit()
            self.stats['word_themes']['new'] = len(id_mapping)
            logger.info("Successfully migrated {} word themes".format(self.stats['word_themes']['new']))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate word themes", e)
            raise

    def migrate_word_theme_relations(self, word_id_mapping, theme_id_mapping):
        _ensure_django()
        import psycopg2

        logger.info("=" * 60)
        logger.info("Migrating Word Theme Relations")
        logger.info("=" * 60)

        legacy_relations = LegacyWordThemeRelation.objects.all().order_by('id')
        self.stats['word_theme_relations']['legacy'] = legacy_relations.count()
        logger.info("Found {} word theme relations in legacy database".format(self.stats['word_theme_relations']['legacy']))

        if self.dry_run:
            logger.info("DRY RUN: Would migrate word theme relations")
            return

        try:
            cursor = self.new_conn.cursor()
            migrated_count = 0
            skipped_count = 0
            for relation in legacy_relations:
                if relation.word_id not in word_id_mapping:
                    logger.warning(
                        "Skipping relation %s: word_id %s not in mapping",
                        relation.id, relation.word_id,
                    )
                    skipped_count += 1
                    continue
                if relation.theme_id not in theme_id_mapping:
                    logger.warning(
                        "Skipping relation %s: theme_id %s not in mapping",
                        relation.id, relation.theme_id,
                    )
                    skipped_count += 1
                    continue

                new_word_id = word_id_mapping[relation.word_id]
                new_theme_id = theme_id_mapping[relation.theme_id]
                cursor.execute("SAVEPOINT migrate_wtr_row")
                try:
                    cursor.execute(
                        """
                        INSERT INTO "WordThemeRelation" ("wordId", "themeId", "order")
                        VALUES (%s, %s, %s)
                        """,
                        (
                            new_word_id,
                            new_theme_id,
                            relation.order or 0
                        ),
                    )
                    migrated_count += 1
                    cursor.execute("RELEASE SAVEPOINT migrate_wtr_row")
                    if migrated_count % 1000 == 0:
                        logger.info("Migrated {} word theme relations...".format(migrated_count))
                except psycopg2.IntegrityError:
                    cursor.execute("ROLLBACK TO SAVEPOINT migrate_wtr_row")
                    skipped_count += 1
                    logger.debug(
                        "Skipped duplicate relation: word_id=%s, theme_id=%s",
                        new_word_id, new_theme_id,
                    )

            self.new_conn.commit()
            self.stats['word_theme_relations']['new'] = migrated_count
            logger.info(
                "Successfully migrated %s word theme relations (skipped %s duplicates)",
                migrated_count, skipped_count,
            )

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate word theme relations", e)
            raise

    def validate_migration(self):
        logger.info("=" * 60)
        logger.info("Validating Migration")
        logger.info("=" * 60)

        if self.dry_run:
            logger.info("DRY RUN: Skipping validation")
            return

        try:
            cursor = self.new_conn.cursor()
            validation_results = {}

            for stat_key, stats in self.stats.items():
                prisma_table = STAT_KEY_TO_PRISMA_TABLE.get(stat_key)
                if not prisma_table:
                    logger.warning("No Prisma table mapping for stat key: %s", stat_key)
                    continue
                cursor.execute('SELECT COUNT(*) FROM "{}"'.format(prisma_table))
                new_count = cursor.fetchone()[0]
                stats['new'] = new_count

                legacy_count = stats['legacy']
                match = legacy_count == new_count
                validation_results[stat_key] = {
                    'legacy': legacy_count,
                    'new': new_count,
                    'match': match,
                    'prisma_table': prisma_table,
                }

                status = "OK" if match else "MISMATCH"
                logger.info(
                    "%s %s (%s): legacy=%s, new=%s",
                    status, stat_key, prisma_table, legacy_count, new_count,
                )

            return validation_results

        except Exception as e:
            self.log_error("Failed to validate migration", e)
            return None

    def run(self):
        logger.info("=" * 60)
        logger.info("Starting Content Data Migration")
        logger.info("Dry Run: {}".format(self.dry_run))
        logger.info("=" * 60)

        try:
            language_id_mapping = self.migrate_languages()

            grammar_course_id_mapping = self.migrate_grammar_courses(language_id_mapping)
            phonetics_course_id_mapping = self.migrate_phonetics_courses(language_id_mapping)
            songs_course_id_mapping = self.migrate_songs_courses(language_id_mapping)

            self.migrate_grammar_lessons(grammar_course_id_mapping)
            self.migrate_phonetics_lessons(phonetics_course_id_mapping)
            self.migrate_songs_lessons(songs_course_id_mapping)

            word_id_mapping = self.migrate_words(language_id_mapping)
            theme_id_mapping = self.migrate_word_themes()
            self.migrate_word_theme_relations(word_id_mapping, theme_id_mapping)

            validation_results = self.validate_migration()

            self.print_summary(validation_results)

        except Exception as e:
            logger.error("Migration failed", exc_info=True)
            if not self.dry_run:
                self.new_conn.rollback()
            raise

    def print_summary(self, validation_results=None):
        logger.info("=" * 60)
        logger.info("Migration Summary")
        logger.info("=" * 60)

        duration = datetime.now() - self.start_time
        logger.info("Duration: {}".format(duration))
        logger.info("Errors: {}".format(len(self.errors)))

        if validation_results:
            logger.info("\nValidation Results:")
            for table_name, result in validation_results.items():
                status = "OK" if result['match'] else "MISMATCH"
                logger.info(
                    "%s %s: legacy=%s, new=%s",
                    status, table_name, result['legacy'], result['new'],
                )

        if self.errors:
            logger.error("\nErrors encountered:")
            for error in self.errors:
                logger.error("  - {}".format(error))


def main():
    parser = argparse.ArgumentParser(
        description='Migrate content data from legacy Django to new Prisma database'
    )
    parser.add_argument('--dry-run', action='store_true', help='No database writes (live mode)')
    parser.add_argument(
        '--new-db-url',
        help='Target Prisma database URL (else DATABASE_URL or NEW_DATABASE_URL)',
    )
    parser.add_argument(
        '--export-dir',
        metavar='DIR',
        help='Write JSON snapshot to DIR (Django on legacy host only)',
    )
    parser.add_argument(
        '--import-dir',
        metavar='DIR',
        help='Load JSON snapshot into target DB (psycopg2 only; use on alfares)',
    )
    parser.add_argument(
        '--truncate-first',
        action='store_true',
        help='With --import-dir: TRUNCATE content tables before load (empty DB recommended)',
    )
    args = parser.parse_args()

    if args.export_dir and args.import_dir:
        logger.error("Use only one of --export-dir or --import-dir")
        return 1
    if args.export_dir:
        if args.dry_run or args.truncate_first:
            logger.error("--export-dir cannot be combined with --dry-run or --truncate-first")
            return 1
        return run_export(args.export_dir)
    if args.import_dir:
        if args.dry_run:
            logger.error("--import-dir cannot be combined with --dry-run")
            return 1
        try:
            return run_import(args.import_dir, args.new_db_url, args.truncate_first)
        except Exception as e:
            logger.error("Import failed: {}".format(e), exc_info=True)
            return 1

    try:
        with ContentDataMigrator(
            new_db_url=args.new_db_url,
            dry_run=args.dry_run
        ) as migrator:
            migrator.run()
            logger.info("Migration completed successfully!")
            return 0
    except Exception as e:
        logger.error("Migration failed: {}".format(e), exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
