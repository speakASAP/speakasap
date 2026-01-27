#!/usr/bin/env python
"""
Content Service Data Migration Script (via Storagebox)

Migrates content data from legacy Django database to new Prisma database
using storagebox as intermediate storage to avoid transferring large amounts
of data directly between servers.

Strategy:
1. Export data from legacy database to SQL files on storagebox
2. Import data from storagebox SQL files to new database

Usage:
    python migrate-content-data-via-storagebox.py [--dry-run] [--storagebox-path PATH]

Environment Variables:
    STORAGEBOX_PATH - Path to storagebox mount (default: /srv/storagebox)
    DATABASE_URL - New Prisma database connection string
"""

import os
import sys
import argparse
import logging
import subprocess
from datetime import datetime

# Setup Django environment (only needed for export, not import)
DJANGO_AVAILABLE = False
try:
    import django
    django.setup()
    DJANGO_AVAILABLE = True
    
    from language.models import Language as LegacyLanguage
    from grammar.models import GrammarCourse as LegacyGrammarCourse, GrammarLesson as LegacyGrammarLesson
    from phonetics.models import PhoneticsCourse as LegacyPhoneticsCourse, PhoneticsLesson as LegacyPhoneticsLesson
    from songs.models import SongsCourse as LegacySongsCourse, SongsLesson as LegacySongsLesson
    from dictionary.models import Word as LegacyWord, WordTheme as LegacyWordTheme, WordThemeRelation as LegacyWordThemeRelation
except Exception as e:
    # Django not available - this is OK for import-only mode
    if '--import-only' not in sys.argv and 'import' not in sys.argv:
        print("Warning: Django setup failed: {}".format(e))
        print("Django is required for export. For import-only, use --import-only flag")
        # Don't exit - import doesn't need Django

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration-storagebox.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class StorageboxMigration:
    """Migrates content data using storagebox as intermediate storage."""

    def __init__(self, storagebox_path=None, new_db_url=None, dry_run=False):
        self.dry_run = dry_run
        self.storagebox_path = storagebox_path or os.getenv('STORAGEBOX_PATH', '/srv/storagebox')
        # Use temp directory first, then copy to storagebox
        self.temp_dir = '/tmp/content-migration-{}'.format(os.getpid())
        self.migration_dir = os.path.join(self.storagebox_path, 'content-migration')
        self.start_time = datetime.now()
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

        # Check storagebox accessibility (read-only check)
        if not os.path.exists(self.storagebox_path):
            logger.warning("Storagebox path does not exist: {}".format(self.storagebox_path))
            logger.warning("Will export to temp directory only")

        # Create temp directory for export (will copy to storagebox after if possible)
        if not self.dry_run:
            os.makedirs(self.temp_dir, exist_ok=True)
            logger.info("Using storagebox path: {}".format(self.storagebox_path))
            logger.info("Temp directory: {}".format(self.temp_dir))
            logger.info("Migration directory: {}".format(self.migration_dir))

    def export_to_sql(self):
        """Export data from legacy database to SQL files on storagebox."""
        logger.info("=" * 60)
        logger.info("Exporting Data to Storagebox")
        logger.info("=" * 60)

        if self.dry_run:
            logger.info("DRY RUN: Would export data to storagebox")
            return
        
        if not DJANGO_AVAILABLE:
            raise ValueError("Django is required for export. Run this script from speakasap-portal directory with DJANGO_SETTINGS_MODULE set.")

        # Export Languages
        logger.info("Exporting Languages...")
        languages = LegacyLanguage.objects.all().order_by('id')
        self.stats['languages']['legacy'] = languages.count()
        self._export_model_to_sql('languages', languages, [
            'id', 'code', 'machine_name', 'name', 'icon', 'order', 'speaker'
        ])

        # Export Grammar Courses
        logger.info("Exporting Grammar Courses...")
        grammar_courses = LegacyGrammarCourse.objects.all().order_by('id')
        self.stats['grammar_courses']['legacy'] = grammar_courses.count()
        self._export_model_to_sql('grammar_courses', grammar_courses, [
            'id', 'title', 'material_language', 'meta_keywords', 'meta_description', 'language_id'
        ])

        # Export Grammar Lessons
        logger.info("Exporting Grammar Lessons...")
        grammar_lessons = LegacyGrammarLesson.objects.all().order_by('id')
        self.stats['grammar_lessons']['legacy'] = grammar_lessons.count()
        self._export_model_to_sql('grammar_lessons', grammar_lessons, [
            'id', 'title', 'course_id', 'template', 'alias', 'url', 'section', 
            'teaser', 'order', 'meta_keywords', 'meta_description'
        ])

        # Export Phonetics Courses
        logger.info("Exporting Phonetics Courses...")
        phonetics_courses = LegacyPhoneticsCourse.objects.all().order_by('id')
        self.stats['phonetics_courses']['legacy'] = phonetics_courses.count()
        self._export_model_to_sql('phonetics_courses', phonetics_courses, [
            'id', 'title', 'material_language', 'meta_keywords', 'meta_description', 'language_id'
        ])

        # Export Phonetics Lessons
        logger.info("Exporting Phonetics Lessons...")
        phonetics_lessons = LegacyPhoneticsLesson.objects.all().order_by('id')
        self.stats['phonetics_lessons']['legacy'] = phonetics_lessons.count()
        self._export_model_to_sql('phonetics_lessons', phonetics_lessons, [
            'id', 'title', 'course_id', 'order', 'meta_keywords', 'meta_description'
        ])

        # Export Songs Courses
        logger.info("Exporting Songs Courses...")
        songs_courses = LegacySongsCourse.objects.all().order_by('id')
        self.stats['songs_courses']['legacy'] = songs_courses.count()
        self._export_model_to_sql('songs_courses', songs_courses, [
            'id', 'title', 'material_language', 'language_id'
        ])

        # Export Songs Lessons
        logger.info("Exporting Songs Lessons...")
        songs_lessons = LegacySongsLesson.objects.all().order_by('id')
        self.stats['songs_lessons']['legacy'] = songs_lessons.count()
        self._export_model_to_sql('songs_lessons', songs_lessons, [
            'id', 'title', 'course_id', 'order'
        ])

        # Export Words
        logger.info("Exporting Words...")
        words = LegacyWord.objects.all().order_by('id')
        self.stats['words']['legacy'] = words.count()
        self._export_model_to_sql('words', words, [
            'id', 'word', 'transcription', 'translation', 'language_id'
        ])

        # Export Word Themes
        logger.info("Exporting Word Themes...")
        word_themes = LegacyWordTheme.objects.all().order_by('id')
        self.stats['word_themes']['legacy'] = word_themes.count()
        self._export_model_to_sql('word_themes', word_themes, [
            'id', 'name', 'module_class', 'order'
        ])

        # Export Word Theme Relations
        logger.info("Exporting Word Theme Relations...")
        word_theme_relations = LegacyWordThemeRelation.objects.all().order_by('id')
        self.stats['word_theme_relations']['legacy'] = word_theme_relations.count()
        self._export_model_to_sql('word_theme_relations', word_theme_relations, [
            'id', 'word_id', 'theme_id', 'order'
        ])

        # Copy files to storagebox
        logger.info("Copying files to storagebox...")
        try:
            os.makedirs(self.migration_dir, exist_ok=True)
            import shutil
            for filename in os.listdir(self.temp_dir):
                if filename.endswith('.sql'):
                    shutil.copy2(
                        os.path.join(self.temp_dir, filename),
                        os.path.join(self.migration_dir, filename)
                    )
            logger.info("✓ Files copied to: {}".format(self.migration_dir))
        except PermissionError:
            logger.warning("⚠ Cannot write to storagebox (permission denied)")
            logger.warning("Files are in: {}".format(self.temp_dir))
            logger.warning("Please copy manually: sudo cp -r {}/* {}".format(self.temp_dir, self.migration_dir))
        
        logger.info("Export completed. Files saved to: {}".format(self.migration_dir))

    def _export_model_to_sql(self, model_name, queryset, fields):
        """Export a model queryset to SQL INSERT statements."""
        sql_file = os.path.join(self.temp_dir, '{}.sql'.format(model_name))
        
        with open(sql_file, 'w', encoding='utf-8') as f:
            f.write("-- {} data export\n".format(model_name))
            f.write("-- Generated: {}\n\n".format(datetime.now().isoformat()))
            
            count = 0
            for obj in queryset:
                values = []
                for field in fields:
                    value = getattr(obj, field, None)
                    if value is None:
                        values.append('NULL')
                    elif isinstance(value, str):
                        # Escape single quotes
                        escaped = value.replace("'", "''")
                        values.append("'{}'".format(escaped))
                    elif isinstance(value, bool):
                        values.append('TRUE' if value else 'FALSE')
                    else:
                        values.append(str(value))
                
                # Write as CSV-like format for easier import
                f.write(','.join(values) + '\n')
                count += 1
                
                if count % 1000 == 0:
                    logger.info("Exported {} {} records...".format(count, model_name))
                    f.flush()

        logger.info("Exported {} {} records to {}".format(count, model_name, sql_file))

    def import_from_sql(self):
        """Import data from storagebox SQL files to new database."""
        logger.info("=" * 60)
        logger.info("Importing Data from Storagebox")
        logger.info("=" * 60)

        if self.dry_run:
            logger.info("DRY RUN: Would import data from storagebox")
            return

        new_db_url = os.getenv('DATABASE_URL') or os.getenv('NEW_DATABASE_URL')
        if not new_db_url:
            raise ValueError("DATABASE_URL or NEW_DATABASE_URL environment variable required")

        # Try to import psycopg2, add user site-packages to path if needed
        try:
            import psycopg2
        except ImportError:
            # Try adding user site-packages to path
            import site
            user_site = site.getusersitepackages()
            if user_site and user_site not in sys.path:
                sys.path.insert(0, user_site)
            try:
                import psycopg2
            except ImportError:
                logger.error("psycopg2 not available. Please install: pip3 install --user psycopg2-binary")
                raise

        conn = psycopg2.connect(new_db_url)
        conn.autocommit = False
        cursor = conn.cursor()

        try:
            # Import in correct order to preserve referential integrity
            language_id_mapping = self._import_languages(cursor)
            grammar_course_id_mapping = self._import_grammar_courses(cursor, language_id_mapping)
            phonetics_course_id_mapping = self._import_phonetics_courses(cursor, language_id_mapping)
            songs_course_id_mapping = self._import_songs_courses(cursor, language_id_mapping)
            
            self._import_grammar_lessons(cursor, grammar_course_id_mapping)
            self._import_phonetics_lessons(cursor, phonetics_course_id_mapping)
            self._import_songs_lessons(cursor, songs_course_id_mapping)
            
            word_id_mapping = self._import_words(cursor, language_id_mapping)
            theme_id_mapping = self._import_word_themes(cursor)
            self._import_word_theme_relations(cursor, word_id_mapping, theme_id_mapping)

            conn.commit()
            logger.info("Import completed successfully")

        except Exception as e:
            conn.rollback()
            logger.error("Import failed: {}".format(e), exc_info=True)
            raise
        finally:
            cursor.close()
            conn.close()

    def _import_languages(self, cursor):
        """Import languages and return ID mapping."""
        logger.info("Importing Languages...")
        sql_file = os.path.join(self.migration_dir, 'languages.sql')
        id_mapping = {}
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                if line.strip().startswith('--') or not line.strip():
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 7:
                    continue
                
                legacy_id = int(parts[0])
                code = parts[1].strip("'")
                machine_name = parts[2].strip("'")
                name = parts[3].strip("'")
                icon_path = parts[4].strip("'") if parts[4] != 'NULL' else ''
                order_val = int(parts[5]) if parts[5] != 'NULL' else 0
                speaker = parts[6].strip("'") if len(parts) > 6 and parts[6] != 'NULL' else 'носитель'
                
                cursor.execute("""
                    INSERT INTO "Language" (code, "machineName", name, "iconPath", "order", speaker)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (code, machine_name, name, icon_path, order_val, speaker))
                
                new_id = cursor.fetchone()[0]
                id_mapping[legacy_id] = new_id
                
                if len(id_mapping) % 10 == 0:
                    logger.info("Imported {} languages...".format(len(id_mapping)))
        
        self.stats['languages']['new'] = len(id_mapping)
        logger.info("Imported {} languages".format(len(id_mapping)))
        return id_mapping

    def _import_grammar_courses(self, cursor, language_id_mapping):
        """Import grammar courses and return ID mapping."""
        logger.info("Importing Grammar Courses...")
        sql_file = os.path.join(self.migration_dir, 'grammar_courses.sql')
        id_mapping = {}
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('--') or not line.strip():
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 6:
                    continue
                
                legacy_id = int(parts[0])
                legacy_lang_id = int(parts[5])
                
                if legacy_lang_id not in language_id_mapping:
                    logger.warning("Skipping grammar course {}: language_id {} not found".format(legacy_id, legacy_lang_id))
                    continue
                
                title = parts[1].strip("'")
                material_lang = parts[2].strip("'") if parts[2] != 'NULL' else 'ru'
                meta_keywords = parts[3].strip("'") if parts[3] != 'NULL' else None
                meta_description = parts[4].strip("'") if parts[4] != 'NULL' else None
                
                cursor.execute("""
                    INSERT INTO "GrammarCourse" (title, "materialLanguage", "metaKeywords", "metaDescription", "languageId")
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (title, material_lang, meta_keywords, meta_description, language_id_mapping[legacy_lang_id]))
                
                new_id = cursor.fetchone()[0]
                id_mapping[legacy_id] = new_id
        
        self.stats['grammar_courses']['new'] = len(id_mapping)
        logger.info("Imported {} grammar courses".format(len(id_mapping)))
        return id_mapping

    def _import_grammar_lessons(self, cursor, course_id_mapping):
        """Import grammar lessons."""
        logger.info("Importing Grammar Lessons...")
        sql_file = os.path.join(self.migration_dir, 'grammar_lessons.sql')
        count = 0
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('--') or not line.strip():
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 11:
                    continue
                
                legacy_course_id = int(parts[2])
                if legacy_course_id not in course_id_mapping:
                    continue
                
                cursor.execute("""
                    INSERT INTO "GrammarLesson" (
                        title, "courseId", template, alias, url, section, teaser, "order", "metaKeywords", "metaDescription"
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    parts[1].strip("'"),
                    course_id_mapping[legacy_course_id],
                    parts[3].strip("'"),
                    parts[4].strip("'") if parts[4] != 'NULL' else None,
                    parts[5].strip("'"),
                    parts[6].strip("'") if parts[6] != 'NULL' else None,
                    parts[7].strip("'") if parts[7] != 'NULL' else None,
                    int(parts[8]) if parts[8] != 'NULL' else 0,
                    parts[9].strip("'") if parts[9] != 'NULL' else None,
                    parts[10].strip("'") if parts[10] != 'NULL' else None,
                ))
                count += 1
                
                if count % 100 == 0:
                    logger.info("Imported {} grammar lessons...".format(count))
        
        self.stats['grammar_lessons']['new'] = count
        logger.info("Imported {} grammar lessons".format(count))

    def _import_phonetics_courses(self, cursor, language_id_mapping):
        """Import phonetics courses and return ID mapping."""
        logger.info("Importing Phonetics Courses...")
        sql_file = os.path.join(self.migration_dir, 'phonetics_courses.sql')
        id_mapping = {}
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('--') or not line.strip():
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 6:
                    continue
                
                legacy_id = int(parts[0])
                legacy_lang_id = int(parts[5])
                
                if legacy_lang_id not in language_id_mapping:
                    continue
                
                cursor.execute("""
                    INSERT INTO "PhoneticsCourse" (title, "materialLanguage", "metaKeywords", "metaDescription", "languageId")
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    parts[1].strip("'"),
                    parts[2].strip("'") if parts[2] != 'NULL' else 'ru',
                    parts[3].strip("'") if parts[3] != 'NULL' else None,
                    parts[4].strip("'") if parts[4] != 'NULL' else None,
                    language_id_mapping[legacy_lang_id]
                ))
                
                new_id = cursor.fetchone()[0]
                id_mapping[legacy_id] = new_id
        
        self.stats['phonetics_courses']['new'] = len(id_mapping)
        logger.info("Imported {} phonetics courses".format(len(id_mapping)))
        return id_mapping

    def _import_phonetics_lessons(self, cursor, course_id_mapping):
        """Import phonetics lessons."""
        logger.info("Importing Phonetics Lessons...")
        sql_file = os.path.join(self.migration_dir, 'phonetics_lessons.sql')
        count = 0
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('--') or not line.strip():
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 6:
                    continue
                
                legacy_course_id = int(parts[2])
                if legacy_course_id not in course_id_mapping:
                    continue
                
                cursor.execute("""
                    INSERT INTO "PhoneticsLesson" (title, "courseId", "order", "metaKeywords", "metaDescription")
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    parts[1].strip("'"),
                    course_id_mapping[legacy_course_id],
                    int(parts[3]),
                    parts[4].strip("'") if parts[4] != 'NULL' else None,
                    parts[5].strip("'") if parts[5] != 'NULL' else None,
                ))
                count += 1
        
        self.stats['phonetics_lessons']['new'] = count
        logger.info("Imported {} phonetics lessons".format(count))

    def _import_songs_courses(self, cursor, language_id_mapping):
        """Import songs courses and return ID mapping."""
        logger.info("Importing Songs Courses...")
        sql_file = os.path.join(self.migration_dir, 'songs_courses.sql')
        id_mapping = {}
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('--') or not line.strip():
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 4:
                    continue
                
                legacy_id = int(parts[0])
                legacy_lang_id = int(parts[3])
                
                if legacy_lang_id not in language_id_mapping:
                    continue
                
                cursor.execute("""
                    INSERT INTO "SongsCourse" (title, "materialLanguage", "languageId")
                    VALUES (%s, %s, %s)
                    RETURNING id
                """, (
                    parts[1].strip("'"),
                    parts[2].strip("'") if parts[2] != 'NULL' else 'ru',
                    language_id_mapping[legacy_lang_id]
                ))
                
                new_id = cursor.fetchone()[0]
                id_mapping[legacy_id] = new_id
        
        self.stats['songs_courses']['new'] = len(id_mapping)
        logger.info("Imported {} songs courses".format(len(id_mapping)))
        return id_mapping

    def _import_songs_lessons(self, cursor, course_id_mapping):
        """Import songs lessons."""
        logger.info("Importing Songs Lessons...")
        sql_file = os.path.join(self.migration_dir, 'songs_lessons.sql')
        count = 0
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('--') or not line.strip():
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 4:
                    continue
                
                legacy_course_id = int(parts[2])
                if legacy_course_id not in course_id_mapping:
                    continue
                
                cursor.execute("""
                    INSERT INTO "SongsLesson" (title, "courseId", "order")
                    VALUES (%s, %s, %s)
                """, (
                    parts[1].strip("'"),
                    course_id_mapping[legacy_course_id],
                    int(parts[3])
                ))
                count += 1
        
        self.stats['songs_lessons']['new'] = count
        logger.info("Imported {} songs lessons".format(count))

    def _import_words(self, cursor, language_id_mapping):
        """Import words and return ID mapping."""
        logger.info("Importing Words...")
        sql_file = os.path.join(self.migration_dir, 'words.sql')
        id_mapping = {}
        skipped = 0
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('--') or not line.strip():
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 5:
                    continue
                
                legacy_id = int(parts[0])
                legacy_lang_id = int(parts[4])
                
                if legacy_lang_id not in language_id_mapping:
                    skipped += 1
                    continue
                
                try:
                    cursor.execute("""
                        INSERT INTO "Word" (word, transcription, translation, "languageId")
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                    """, (
                        parts[1].strip("'"),
                        parts[2].strip("'") if parts[2] != 'NULL' else None,
                        parts[3].strip("'") if parts[3] != 'NULL' else None,
                        language_id_mapping[legacy_lang_id]
                    ))
                    
                    new_id = cursor.fetchone()[0]
                    id_mapping[legacy_id] = new_id
                    
                    if len(id_mapping) % 1000 == 0:
                        logger.info("Imported {} words...".format(len(id_mapping)))
                except Exception as e:
                    skipped += 1
                    if 'unique' not in str(e).lower():
                        logger.warning("Error importing word {}: {}".format(legacy_id, e))
        
        self.stats['words']['new'] = len(id_mapping)
        logger.info("Imported {} words (skipped {} duplicates/errors)".format(len(id_mapping), skipped))
        return id_mapping

    def _import_word_themes(self, cursor):
        """Import word themes and return ID mapping."""
        logger.info("Importing Word Themes...")
        sql_file = os.path.join(self.migration_dir, 'word_themes.sql')
        id_mapping = {}
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('--') or not line.strip():
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 4:
                    continue
                
                legacy_id = int(parts[0])
                
                cursor.execute("""
                    INSERT INTO "WordTheme" (name, "moduleClass", "order")
                    VALUES (%s, %s, %s)
                    RETURNING id
                """, (
                    parts[1].strip("'"),
                    parts[2].strip("'") if parts[2] != 'NULL' else '',
                    int(parts[3]) if parts[3] != 'NULL' else 0
                ))
                
                new_id = cursor.fetchone()[0]
                id_mapping[legacy_id] = new_id
        
        self.stats['word_themes']['new'] = len(id_mapping)
        logger.info("Imported {} word themes".format(len(id_mapping)))
        return id_mapping

    def _import_word_theme_relations(self, cursor, word_id_mapping, theme_id_mapping):
        """Import word theme relations."""
        logger.info("Importing Word Theme Relations...")
        sql_file = os.path.join(self.migration_dir, 'word_theme_relations.sql')
        count = 0
        skipped = 0
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('--') or not line.strip():
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 4:
                    continue
                
                legacy_word_id = int(parts[1])
                legacy_theme_id = int(parts[2])
                
                if legacy_word_id not in word_id_mapping or legacy_theme_id not in theme_id_mapping:
                    skipped += 1
                    continue
                
                try:
                    cursor.execute("""
                        INSERT INTO "WordThemeRelation" ("wordId", "themeId", "order")
                        VALUES (%s, %s, %s)
                    """, (
                        word_id_mapping[legacy_word_id],
                        theme_id_mapping[legacy_theme_id],
                        int(parts[3]) if parts[3] != 'NULL' else 0
                    ))
                    count += 1
                    
                    if count % 1000 == 0:
                        logger.info("Imported {} word theme relations...".format(count))
                except Exception as e:
                    skipped += 1
                    if 'unique' not in str(e).lower():
                        logger.warning("Error importing relation: {}".format(e))
        
        self.stats['word_theme_relations']['new'] = count
        logger.info("Imported {} word theme relations (skipped {} duplicates/errors)".format(count, skipped))

    def run(self):
        """Execute the full migration process."""
        logger.info("=" * 60)
        logger.info("Starting Content Data Migration via Storagebox")
        logger.info("Dry Run: {}".format(self.dry_run))
        logger.info("Storagebox Path: {}".format(self.storagebox_path))
        logger.info("=" * 60)

        try:
            # Step 1: Export to storagebox
            self.export_to_sql()
            
            # Step 2: Import from storagebox (run this on statex server)
            logger.info("\n" + "=" * 60)
            logger.info("NOTE: Import step should be run on statex server")
            logger.info("=" * 60)
            
            if not self.dry_run:
                # Only import if DATABASE_URL is set (for statex server)
                if os.getenv('DATABASE_URL') or os.getenv('NEW_DATABASE_URL'):
                    self.import_from_sql()
                else:
                    logger.info("Skipping import (DATABASE_URL not set - run import on statex server)")
            
            # Print summary
            duration = datetime.now() - self.start_time
            logger.info("=" * 60)
            logger.info("Migration Summary")
            logger.info("=" * 60)
            logger.info("Duration: {}".format(duration))
            
            for table_name, stats in self.stats.items():
                logger.info("{}: legacy={}, new={}".format(
                    table_name, stats['legacy'], stats['new']
                ))

        except Exception as e:
            logger.error("Migration failed: {}".format(e), exc_info=True)
            raise


def main():
    parser = argparse.ArgumentParser(description='Migrate content data via storagebox')
    parser.add_argument('--dry-run', action='store_true', help='Perform a dry run')
    parser.add_argument('--import-only', action='store_true', help='Import only (skip export)')
    parser.add_argument('--export-only', action='store_true', help='Export only (skip import)')
    parser.add_argument('--storagebox-path', help='Path to storagebox mount (default: /srv/storagebox)')
    args = parser.parse_args()

    try:
        migrator = StorageboxMigration(
            storagebox_path=args.storagebox_path,
            dry_run=args.dry_run
        )
        
        if args.import_only:
            # Import only mode
            if not args.dry_run:
                migrator.import_from_sql()
            else:
                logger.info("DRY RUN: Would import data from storagebox")
        elif args.export_only:
            # Export only mode
            migrator.export_to_sql()
        else:
            # Full migration (export + import if DATABASE_URL set)
            migrator.run()
        
        logger.info("Migration completed successfully!")
        return 0
    except Exception as e:
        logger.error("Migration failed: {}".format(e), exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
