#!/usr/bin/env python
"""
Content Service Data Migration Script

Migrates content data from legacy Django database to new Prisma database.
Uses Django ORM to read legacy data and psycopg2 to write to new database.

Usage:
    python migrate-content-data.py [--dry-run] [--legacy-db-url URL] [--new-db-url URL]

Environment Variables:
    LEGACY_DATABASE_URL - Legacy Django database connection string
    NEW_DATABASE_URL - New Prisma database connection string (from DATABASE_URL)
"""

import os
import sys
import argparse
import logging
from datetime import datetime
# from typing import Dict, List, Optional, Any  # Not available in Python 3.4
import psycopg2
# from psycopg2.extras import execute_values  # Not used
# from psycopg2 import sql  # Not used

# Setup Django environment
# This script should be run from speakasap-portal directory or with DJANGO_SETTINGS_MODULE set
try:
    import django
    django.setup()
except Exception as e:
    print("Warning: Django setup failed: {}".format(e))
    print("Make sure to run this script from speakasap-portal directory or set DJANGO_SETTINGS_MODULE")
    sys.exit(1)

from language.models import Language as LegacyLanguage
from grammar.models import GrammarCourse as LegacyGrammarCourse, GrammarLesson as LegacyGrammarLesson
from phonetics.models import PhoneticsCourse as LegacyPhoneticsCourse, PhoneticsLesson as LegacyPhoneticsLesson
from songs.models import SongsCourse as LegacySongsCourse, SongsLesson as LegacySongsLesson
from dictionary.models import Word as LegacyWord, WordTheme as LegacyWordTheme, WordThemeRelation as LegacyWordThemeRelation

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


class ContentDataMigrator:
    """Migrates content data from legacy Django database to new Prisma database."""

    def __init__(self, legacy_db_url=None, new_db_url=None, dry_run=False):
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

        # Connect to new database
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
        """Log an error and add to errors list."""
        error_msg = "{}: {}".format(message, exception) if exception else message
        logger.error(error_msg)
        self.errors.append(error_msg)
        if exception:
            logger.exception(exception)

    def migrate_languages(self):
        """Migrate Language records. Returns mapping of legacy_id -> new_id."""
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
                # Extract icon path from ImageField
                icon_path = str(lang.icon) if lang.icon else ''

                # Insert language
                cursor.execute("""
                    INSERT INTO "Language" (code, "machineName", name, "iconPath", "order", speaker)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    lang.code,
                    lang.machine_name,
                    lang.name,
                    icon_path,
                    lang.order,
                    lang.speaker or 'носитель'
                ))
                new_id = cursor.fetchone()[0]
                id_mapping[lang.id] = new_id
                logger.debug("Migrated language: {lang.code} (legacy_id={lang.id} -> new_id={})".format(new_id))

            self.new_conn.commit()
            self.stats['languages']['new'] = len(id_mapping)
            logger.info("Successfully migrated {} languages".format(self.stats['languages']['new']))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate languages", e)
            raise

    def migrate_grammar_courses(self, language_id_mapping):
        """Migrate GrammarCourse records. Returns mapping of legacy_id -> new_id."""
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
                    logger.warning("Skipping grammar course {course.id}: language_id {} not found".format(course.language_id))
                    continue

                new_language_id = language_id_mapping[course.language_id]
                cursor.execute("""
                    INSERT INTO "GrammarCourse" (title, "materialLanguage", "metaKeywords", "metaDescription", "languageId")
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    course.title,
                    course.material_language or 'ru',
                    course.meta_keywords or None,
                    course.meta_description or None,
                    new_language_id
                ))
                new_id = cursor.fetchone()[0]
                id_mapping[course.id] = new_id
                logger.debug("Migrated grammar course: {course.title} (legacy_id={course.id} -> new_id={})".format(new_id))

            self.new_conn.commit()
            self.stats['grammar_courses']['new'] = len(id_mapping)
            logger.info("Successfully migrated {} grammar courses".format(self.stats['grammar_courses']['new']))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate grammar courses", e)
            raise

    def migrate_grammar_lessons(self, course_id_mapping):
        """Migrate GrammarLesson records."""
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
                    logger.warning("Skipping grammar lesson {lesson.id}: course_id {} not found".format(lesson.course_id))
                    continue

                new_course_id = course_id_mapping[lesson.course_id]
                cursor.execute("""
                    INSERT INTO "GrammarLesson" (
                        title, "courseId", template, alias, url, section, teaser, "order", "metaKeywords", "metaDescription"
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
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
                ))
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
        """Migrate PhoneticsCourse records. Returns mapping of legacy_id -> new_id."""
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
                    logger.warning("Skipping phonetics course {course.id}: language_id {} not found".format(course.language_id))
                    continue

                new_language_id = language_id_mapping[course.language_id]
                cursor.execute("""
                    INSERT INTO "PhoneticsCourse" (title, "materialLanguage", "metaKeywords", "metaDescription", "languageId")
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    course.title,
                    course.material_language or 'ru',
                    course.meta_keywords or None,
                    course.meta_description or None,
                    new_language_id
                ))
                new_id = cursor.fetchone()[0]
                id_mapping[course.id] = new_id
                logger.debug("Migrated phonetics course: {course.title} (legacy_id={course.id} -> new_id={})".format(new_id))

            self.new_conn.commit()
            self.stats['phonetics_courses']['new'] = len(id_mapping)
            logger.info("Successfully migrated {} phonetics courses".format(self.stats['phonetics_courses']['new']))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate phonetics courses", e)
            raise

    def migrate_phonetics_lessons(self, course_id_mapping):
        """Migrate PhoneticsLesson records."""
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
                    logger.warning("Skipping phonetics lesson {lesson.id}: course_id {} not found".format(lesson.course_id))
                    continue

                new_course_id = course_id_mapping[lesson.course_id]
                cursor.execute("""
                    INSERT INTO "PhoneticsLesson" (title, "courseId", "order", "metaKeywords", "metaDescription")
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    lesson.title,
                    new_course_id,
                    lesson.order,
                    lesson.meta_keywords or None,
                    lesson.meta_description or None
                ))
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
        """Migrate SongsCourse records. Returns mapping of legacy_id -> new_id."""
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
                    logger.warning("Skipping songs course {course.id}: language_id {} not found".format(course.language_id))
                    continue

                new_language_id = language_id_mapping[course.language_id]
                cursor.execute("""
                    INSERT INTO "SongsCourse" (title, "materialLanguage", "languageId")
                    VALUES (%s, %s, %s)
                    RETURNING id
                """, (
                    course.title,
                    course.material_language or 'ru',
                    new_language_id
                ))
                new_id = cursor.fetchone()[0]
                id_mapping[course.id] = new_id
                logger.debug("Migrated songs course: {course.title} (legacy_id={course.id} -> new_id={})".format(new_id))

            self.new_conn.commit()
            self.stats['songs_courses']['new'] = len(id_mapping)
            logger.info("Successfully migrated {} songs courses".format(self.stats['songs_courses']['new']))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate songs courses", e)
            raise

    def migrate_songs_lessons(self, course_id_mapping):
        """Migrate SongsLesson records."""
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
                    logger.warning("Skipping songs lesson {lesson.id}: course_id {} not found".format(lesson.course_id))
                    continue

                new_course_id = course_id_mapping[lesson.course_id]
                cursor.execute("""
                    INSERT INTO "SongsLesson" (title, "courseId", "order")
                    VALUES (%s, %s, %s)
                """, (
                    lesson.title,
                    new_course_id,
                    lesson.order
                ))
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
        """Migrate Word records. Returns mapping of legacy_id -> new_id."""
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
                    logger.warning("Skipping word {word.id}: language_id {} not found".format(word.language_id))
                    skipped_count += 1
                    continue

                new_language_id = language_id_mapping[word.language_id]
                try:
                    cursor.execute("""
                        INSERT INTO "Word" (word, transcription, translation, "languageId")
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                    """, (
                        word.word,
                        word.transcription or None,
                        word.translation or None,
                        new_language_id
                    ))
                    new_id = cursor.fetchone()[0]
                    id_mapping[word.id] = new_id
                    migrated_count += 1
                    if migrated_count % 1000 == 0:
                        logger.info("Migrated {} words...".format(migrated_count))
                except psycopg2.IntegrityError as e:
                    # Unique constraint violation - word already exists
                    skipped_count += 1
                    logger.debug("Skipped duplicate word: {word.word} (language_id={})".format(new_language_id))

            self.new_conn.commit()
            self.stats['words']['new'] = migrated_count
            logger.info("Successfully migrated {self.stats['words']['new']} words (skipped {} duplicates)".format(skipped_count))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate words", e)
            raise

    def migrate_word_themes(self):
        """Migrate WordTheme records. Returns mapping of legacy_id -> new_id."""
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
                cursor.execute("""
                    INSERT INTO "WordTheme" (name, "moduleClass", "order")
                    VALUES (%s, %s, %s)
                    RETURNING id
                """, (
                    theme.name,
                    theme.module_class or '',
                    theme.order or 0
                ))
                new_id = cursor.fetchone()[0]
                id_mapping[theme.id] = new_id
                logger.debug("Migrated word theme: {theme.name} (legacy_id={theme.id} -> new_id={})".format(new_id))

            self.new_conn.commit()
            self.stats['word_themes']['new'] = len(id_mapping)
            logger.info("Successfully migrated {} word themes".format(self.stats['word_themes']['new']))
            return id_mapping

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate word themes", e)
            raise

    def migrate_word_theme_relations(self, word_id_mapping, theme_id_mapping):
        """Migrate WordThemeRelation records."""
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
                    logger.warning("Skipping relation {relation.id}: word_id {} not found".format(relation.word_id))
                    skipped_count += 1
                    continue
                if relation.theme_id not in theme_id_mapping:
                    logger.warning("Skipping relation {relation.id}: theme_id {} not found".format(relation.theme_id))
                    skipped_count += 1
                    continue

                new_word_id = word_id_mapping[relation.word_id]
                new_theme_id = theme_id_mapping[relation.theme_id]
                try:
                    cursor.execute("""
                        INSERT INTO "WordThemeRelation" ("wordId", "themeId", "order")
                        VALUES (%s, %s, %s)
                    """, (
                        new_word_id,
                        new_theme_id,
                        relation.order or 0
                    ))
                    migrated_count += 1
                    if migrated_count % 1000 == 0:
                        logger.info("Migrated {} word theme relations...".format(migrated_count))
                except psycopg2.IntegrityError as e:
                    # Unique constraint violation - relation already exists
                    skipped_count += 1
                    logger.debug("Skipped duplicate relation: word_id={new_word_id}, theme_id={}".format(new_theme_id))

            self.new_conn.commit()
            self.stats['word_theme_relations']['new'] = migrated_count
            logger.info("Successfully migrated {self.stats['word_theme_relations']['new']} word theme relations (skipped {} duplicates)".format(skipped_count))

        except Exception as e:
            self.new_conn.rollback()
            self.log_error("Failed to migrate word theme relations", e)
            raise

    def validate_migration(self):
        """Validate migration by comparing record counts."""
        logger.info("=" * 60)
        logger.info("Validating Migration")
        logger.info("=" * 60)

        if self.dry_run:
            logger.info("DRY RUN: Skipping validation")
            return

        try:
            cursor = self.new_conn.cursor()
            validation_results = {}

            for table_name, stats in self.stats.items():
                # Get count from new database
                table_name_camel = ''.join(word.capitalize() for word in table_name.split('_'))
                cursor.execute('SELECT COUNT(*) FROM "{}"'.format(table_name_camel))
                new_count = cursor.fetchone()[0]
                stats['new'] = new_count

                legacy_count = stats['legacy']
                match = legacy_count == new_count
                validation_results[table_name] = {
                    'legacy': legacy_count,
                    'new': new_count,
                    'match': match
                }

                status = "✓" if match else "✗"
                logger.info("{status} {table_name}: legacy={legacy_count}, new={}".format(new_count))

            return validation_results

        except Exception as e:
            self.log_error("Failed to validate migration", e)
            return None

    def run(self):
        """Execute the full migration process."""
        logger.info("=" * 60)
        logger.info("Starting Content Data Migration")
        logger.info("Dry Run: {}".format(self.dry_run))
        logger.info("=" * 60)

        try:
            # Step 1: Migrate Languages (must be first)
            language_id_mapping = self.migrate_languages()

            # Step 2: Migrate Courses
            grammar_course_id_mapping = self.migrate_grammar_courses(language_id_mapping)
            phonetics_course_id_mapping = self.migrate_phonetics_courses(language_id_mapping)
            songs_course_id_mapping = self.migrate_songs_courses(language_id_mapping)

            # Step 3: Migrate Lessons
            self.migrate_grammar_lessons(grammar_course_id_mapping)
            self.migrate_phonetics_lessons(phonetics_course_id_mapping)
            self.migrate_songs_lessons(songs_course_id_mapping)

            # Step 4: Migrate Dictionary data
            word_id_mapping = self.migrate_words(language_id_mapping)
            theme_id_mapping = self.migrate_word_themes()
            self.migrate_word_theme_relations(word_id_mapping, theme_id_mapping)

            # Step 5: Validate
            validation_results = self.validate_migration()

            # Print summary
            self.print_summary(validation_results)

        except Exception as e:
            logger.error("Migration failed", exc_info=True)
            if not self.dry_run:
                self.new_conn.rollback()
            raise

    def print_summary(self, validation_results=None):
        """Print migration summary."""
        logger.info("=" * 60)
        logger.info("Migration Summary")
        logger.info("=" * 60)

        duration = datetime.now() - self.start_time
        logger.info("Duration: {}".format(duration))
        logger.info("Errors: {}".format(len(self.errors)))

        if validation_results:
            logger.info("\nValidation Results:")
            for table_name, result in validation_results.items():
                status = "✓" if result['match'] else "✗"
                logger.info("{status} {table_name}: legacy={result['legacy']}, new={}".format(result['new']))

        if self.errors:
            logger.error("\nErrors encountered:")
            for error in self.errors:
                logger.error("  - {}".format(error))


def main():
    parser = argparse.ArgumentParser(description='Migrate content data from legacy Django to new Prisma database')
    parser.add_argument('--dry-run', action='store_true', help='Perform a dry run without writing to database')
    parser.add_argument('--legacy-db-url', help='Legacy database URL (uses Django settings if not provided)')
    parser.add_argument('--new-db-url', help='New database URL (uses DATABASE_URL env var if not provided)')
    args = parser.parse_args()

    try:
        with ContentDataMigrator(
            legacy_db_url=args.legacy_db_url,
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
