#!/usr/bin/env python3
"""
Simple import script using docker exec psql
Reads CSV files from storagebox and imports to database
"""

import os
import sys
import subprocess
import logging
import csv
from urllib.parse import urlparse, unquote

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def parse_db_url(db_url):
    """Parse DATABASE_URL into components."""
    parsed = urlparse(db_url)
    password = unquote(parsed.password) if parsed.password else None
    return {
        'user': parsed.username,
        'password': password,
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'database': parsed.path.lstrip('/').split('?')[0]
    }


def run_psql_docker(db_config, sql_command, input_data=None):
    """Execute SQL command using docker exec psql."""
    env = os.environ.copy()
    if db_config['password']:
        env['PGPASSWORD'] = db_config['password']
    
    # Use docker exec if host is db-server-postgres, otherwise direct psql
    if db_config['host'] == 'db-server-postgres':
        cmd = [
            'docker', 'exec', '-i', 'db-server-postgres',
            'psql', '-U', db_config['user'], '-d', db_config['database']
        ]
    else:
        cmd = [
            'psql',
            '-h', db_config['host'],
            '-p', str(db_config['port']),
            '-U', db_config['user'],
            '-d', db_config['database']
        ]
    
    if input_data:
        process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE, env=env, text=True)
        stdout, stderr = process.communicate(input=input_data)
    else:
        cmd.extend(['-c', sql_command])
        process = subprocess.run(cmd, env=env, capture_output=True, text=True)
        stdout, stderr = process.stdout, process.stderr
    
    if process.returncode != 0:
        logger.error("psql error: {}".format(stderr))
        raise RuntimeError("psql failed: {}".format(stderr))
    return stdout


def escape_sql_string(value):
    """Escape single quotes for SQL."""
    if value is None or value == 'NULL':
        return 'NULL'
    return "'{}'".format(str(value).replace("'", "''"))


def parse_csv_line(line):
    """Parse CSV line with single-quoted fields."""
    line = line.strip()
    if line.startswith('--') or not line:
        return None
    
    # Use csv.reader with single quote as quotechar
    # Need to handle the format: id,'field1','field2, with comma','field3'
    try:
        reader = csv.reader([line], quotechar="'", delimiter=',', skipinitialspace=True)
        row = next(reader)
        # Filter out empty strings and validate
        row = [f.strip() for f in row if f.strip()]
        if len(row) == 0:
            return None
        # Validate first field is numeric (ID)
        try:
            int(row[0])
        except ValueError:
            logger.debug("Skipping line - first field not numeric: {}".format(row[0][:50] if row else 'empty'))
            return None
        return row
    except Exception as e:
        logger.debug("CSV parse error for line: {} - {}".format(line[:50], e))
        return None


def import_languages(migration_dir, db_config):
    """Import languages from CSV file."""
    logger.info("Importing Languages...")
    csv_file = os.path.join(migration_dir, 'languages.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return {}
    
    # First, get existing languages by code
    logger.info("Checking existing languages...")
    existing_sql = 'SELECT id, code FROM "Language";'
    existing_result = run_psql_docker(db_config, existing_sql)
    existing_by_code = {}
    for line in existing_result.split('\n'):
        parts = line.strip().split('|')
        if len(parts) >= 2 and parts[0].strip().isdigit():
            existing_by_code[parts[1].strip()] = int(parts[0].strip())
    
    logger.info("Found {} existing languages".format(len(existing_by_code)))
    
    id_mapping = {}
    count = 0
    skipped = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line in f:
            row = parse_csv_line(line)
            if not row or len(row) < 7:
                continue
            
            legacy_id = int(row[0])
            code = row[1]
            machine_name = row[2]
            name = row[3]
            icon_path = row[4] if row[4] != 'NULL' else ''
            order_val = row[5] if row[5] != 'NULL' else '0'
            speaker = row[6] if len(row) > 6 and row[6] != 'NULL' else 'носитель'
            
            # Check if language already exists
            if code in existing_by_code:
                id_mapping[legacy_id] = existing_by_code[code]
                skipped += 1
                logger.debug("Language {} already exists (id={})".format(code, existing_by_code[code]))
                continue
            
            sql = """
                INSERT INTO "Language" (code, "machineName", name, "iconPath", "order", speaker)
                VALUES ({}, {}, {}, {}, {}, {})
                RETURNING id;
            """.format(
                escape_sql_string(code),
                escape_sql_string(machine_name),
                escape_sql_string(name),
                escape_sql_string(icon_path),
                order_val,
                escape_sql_string(speaker)
            )
            
            try:
                result = run_psql_docker(db_config, sql)
                # Extract ID from result
                for line_result in result.split('\n'):
                    if line_result.strip().isdigit():
                        new_id = int(line_result.strip())
                        id_mapping[legacy_id] = new_id
                        count += 1
                        break
            except Exception as e:
                logger.warning("Failed to import language {}: {}".format(legacy_id, e))
    
    logger.info("Imported {} languages ({} already existed)".format(count, skipped))
    return id_mapping


def import_grammar_courses(migration_dir, db_config, language_id_mapping):
    """Import grammar courses."""
    logger.info("Importing Grammar Courses...")
    csv_file = os.path.join(migration_dir, 'grammar_courses.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return {}
    
    id_mapping = {}
    count = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith('--') or not line.strip():
                continue
            
            row = parse_csv_line(line)
            if not row or len(row) < 6:
                continue
            
            legacy_id = int(row[0])
            legacy_lang_id = int(row[5])
            
            if legacy_lang_id not in language_id_mapping:
                logger.warning("Skipping grammar course {}: language_id {} not found".format(legacy_id, legacy_lang_id))
                continue
            
            title = row[1]
            material_lang = row[2] if row[2] != 'NULL' else 'ru'
            meta_keywords = row[3] if row[3] != 'NULL' else None
            meta_description = row[4] if row[4] != 'NULL' else None
            
            sql = """
                INSERT INTO "GrammarCourse" (title, "materialLanguage", "metaKeywords", "metaDescription", "languageId")
                VALUES ({}, {}, {}, {}, {})
                RETURNING id;
            """.format(
                escape_sql_string(title),
                escape_sql_string(material_lang),
                escape_sql_string(meta_keywords),
                escape_sql_string(meta_description),
                language_id_mapping[legacy_lang_id]
            )
            
            try:
                result = run_psql_docker(db_config, sql)
                for line_result in result.split('\n'):
                    if line_result.strip().isdigit():
                        new_id = int(line_result.strip())
                        id_mapping[legacy_id] = new_id
                        count += 1
                        break
            except Exception as e:
                logger.warning("Failed to import grammar course {}: {}".format(legacy_id, e))
    
    logger.info("Imported {} grammar courses".format(count))
    return id_mapping


def import_grammar_lessons(migration_dir, db_config, course_id_mapping):
    """Import grammar lessons."""
    logger.info("Importing Grammar Lessons...")
    csv_file = os.path.join(migration_dir, 'grammar_lessons.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return
    
    count = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith('--') or not line.strip():
                continue
            
            row = parse_csv_line(line)
            if not row or len(row) < 11:
                continue
            
            legacy_course_id = int(row[2])
            if legacy_course_id not in course_id_mapping:
                continue
            
            title = row[1]
            template = row[3]
            alias = row[4] if row[4] != 'NULL' else None
            url = row[5]
            section = row[6] if row[6] != 'NULL' else None
            teaser = row[7] if row[7] != 'NULL' else None
            order_val = row[8] if row[8] != 'NULL' else '0'
            meta_keywords = row[9] if row[9] != 'NULL' else None
            meta_description = row[10] if row[10] != 'NULL' else None
            
            sql = """
                INSERT INTO "GrammarLesson" (
                    title, "courseId", template, alias, url, section, teaser, "order", "metaKeywords", "metaDescription"
                )
                VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {});
            """.format(
                escape_sql_string(title),
                course_id_mapping[legacy_course_id],
                escape_sql_string(template),
                escape_sql_string(alias),
                escape_sql_string(url),
                escape_sql_string(section),
                escape_sql_string(teaser),
                order_val,
                escape_sql_string(meta_keywords),
                escape_sql_string(meta_description)
            )
            
            try:
                run_psql_docker(db_config, sql)
                count += 1
                if count % 100 == 0:
                    logger.info("Imported {} grammar lessons...".format(count))
            except Exception as e:
                logger.warning("Failed to import grammar lesson: {}".format(e))
    
    logger.info("Imported {} grammar lessons".format(count))


def import_phonetics_courses(migration_dir, db_config, language_id_mapping):
    """Import phonetics courses."""
    logger.info("Importing Phonetics Courses...")
    csv_file = os.path.join(migration_dir, 'phonetics_courses.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return {}
    
    id_mapping = {}
    count = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith('--') or not line.strip():
                continue
            
            row = parse_csv_line(line)
            if not row or len(row) < 6:
                continue
            
            legacy_id = int(row[0])
            legacy_lang_id = int(row[5])
            
            if legacy_lang_id not in language_id_mapping:
                continue
            
            title = row[1]
            material_lang = row[2] if row[2] != 'NULL' else 'ru'
            meta_keywords = row[3] if row[3] != 'NULL' else None
            meta_description = row[4] if row[4] != 'NULL' else None
            
            sql = """
                INSERT INTO "PhoneticsCourse" (title, "materialLanguage", "metaKeywords", "metaDescription", "languageId")
                VALUES ({}, {}, {}, {}, {})
                RETURNING id;
            """.format(
                escape_sql_string(title),
                escape_sql_string(material_lang),
                escape_sql_string(meta_keywords),
                escape_sql_string(meta_description),
                language_id_mapping[legacy_lang_id]
            )
            
            try:
                result = run_psql_docker(db_config, sql)
                for line_result in result.split('\n'):
                    if line_result.strip().isdigit():
                        new_id = int(line_result.strip())
                        id_mapping[legacy_id] = new_id
                        count += 1
                        break
            except Exception as e:
                logger.warning("Failed to import phonetics course {}: {}".format(legacy_id, e))
    
    logger.info("Imported {} phonetics courses".format(count))
    return id_mapping


def import_phonetics_lessons(migration_dir, db_config, course_id_mapping):
    """Import phonetics lessons."""
    logger.info("Importing Phonetics Lessons...")
    csv_file = os.path.join(migration_dir, 'phonetics_lessons.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return
    
    count = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith('--') or not line.strip():
                continue
            
            row = parse_csv_line(line)
            if not row or len(row) < 6:
                continue
            
            legacy_course_id = int(row[2])
            if legacy_course_id not in course_id_mapping:
                continue
            
            title = row[1]
            order_val = row[3]
            meta_keywords = row[4] if row[4] != 'NULL' else None
            meta_description = row[5] if row[5] != 'NULL' else None
            
            sql = """
                INSERT INTO "PhoneticsLesson" (title, "courseId", "order", "metaKeywords", "metaDescription")
                VALUES ({}, {}, {}, {}, {});
            """.format(
                escape_sql_string(title),
                course_id_mapping[legacy_course_id],
                order_val,
                escape_sql_string(meta_keywords),
                escape_sql_string(meta_description)
            )
            
            try:
                run_psql_docker(db_config, sql)
                count += 1
            except Exception as e:
                logger.warning("Failed to import phonetics lesson: {}".format(e))
    
    logger.info("Imported {} phonetics lessons".format(count))


def import_songs_courses(migration_dir, db_config, language_id_mapping):
    """Import songs courses."""
    logger.info("Importing Songs Courses...")
    csv_file = os.path.join(migration_dir, 'songs_courses.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return {}
    
    id_mapping = {}
    count = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith('--') or not line.strip():
                continue
            
            row = parse_csv_line(line)
            if not row or len(row) < 4:
                continue
            
            legacy_id = int(row[0])
            legacy_lang_id = int(row[3])
            
            if legacy_lang_id not in language_id_mapping:
                continue
            
            title = row[1]
            material_lang = row[2] if row[2] != 'NULL' else 'ru'
            
            sql = """
                INSERT INTO "SongsCourse" (title, "materialLanguage", "languageId")
                VALUES ({}, {}, {})
                RETURNING id;
            """.format(
                escape_sql_string(title),
                escape_sql_string(material_lang),
                language_id_mapping[legacy_lang_id]
            )
            
            try:
                result = run_psql_docker(db_config, sql)
                for line_result in result.split('\n'):
                    if line_result.strip().isdigit():
                        new_id = int(line_result.strip())
                        id_mapping[legacy_id] = new_id
                        count += 1
                        break
            except Exception as e:
                logger.warning("Failed to import songs course {}: {}".format(legacy_id, e))
    
    logger.info("Imported {} songs courses".format(count))
    return id_mapping


def import_songs_lessons(migration_dir, db_config, course_id_mapping):
    """Import songs lessons."""
    logger.info("Importing Songs Lessons...")
    csv_file = os.path.join(migration_dir, 'songs_lessons.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return
    
    count = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith('--') or not line.strip():
                continue
            
            row = parse_csv_line(line)
            if not row or len(row) < 4:
                continue
            
            legacy_course_id = int(row[2])
            if legacy_course_id not in course_id_mapping:
                continue
            
            title = row[1]
            order_val = row[3]
            
            sql = """
                INSERT INTO "SongsLesson" (title, "courseId", "order")
                VALUES ({}, {}, {});
            """.format(
                escape_sql_string(title),
                course_id_mapping[legacy_course_id],
                order_val
            )
            
            try:
                run_psql_docker(db_config, sql)
                count += 1
            except Exception as e:
                logger.warning("Failed to import songs lesson: {}".format(e))
    
    logger.info("Imported {} songs lessons".format(count))


def import_words(migration_dir, db_config, language_id_mapping):
    """Import words."""
    logger.info("Importing Words...")
    csv_file = os.path.join(migration_dir, 'words.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return {}
    
    id_mapping = {}
    count = 0
    skipped = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith('--') or not line.strip():
                continue
            
            row = parse_csv_line(line)
            if not row or len(row) < 5:
                continue
            
            legacy_id = int(row[0])
            legacy_lang_id = int(row[4])
            
            if legacy_lang_id not in language_id_mapping:
                skipped += 1
                continue
            
            word = row[1]
            transcription = row[2] if row[2] != 'NULL' else None
            translation = row[3] if row[3] != 'NULL' else None
            
            sql = """
                INSERT INTO "Word" (word, transcription, translation, "languageId")
                VALUES ({}, {}, {}, {})
                RETURNING id;
            """.format(
                escape_sql_string(word),
                escape_sql_string(transcription),
                escape_sql_string(translation),
                language_id_mapping[legacy_lang_id]
            )
            
            try:
                result = run_psql_docker(db_config, sql)
                for line_result in result.split('\n'):
                    if line_result.strip().isdigit():
                        new_id = int(line_result.strip())
                        id_mapping[legacy_id] = new_id
                        count += 1
                        if count % 1000 == 0:
                            logger.info("Imported {} words...".format(count))
                        break
            except Exception as e:
                skipped += 1
                if 'unique' not in str(e).lower():
                    logger.warning("Failed to import word {}: {}".format(legacy_id, e))
    
    logger.info("Imported {} words (skipped {} duplicates/errors)".format(count, skipped))
    return id_mapping


def import_word_themes(migration_dir, db_config):
    """Import word themes."""
    logger.info("Importing Word Themes...")
    csv_file = os.path.join(migration_dir, 'word_themes.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return {}
    
    id_mapping = {}
    count = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith('--') or not line.strip():
                continue
            
            row = parse_csv_line(line)
            if not row or len(row) < 4:
                continue
            
            legacy_id = int(row[0])
            name = row[1]
            module_class = row[2] if row[2] != 'NULL' else ''
            order_val = row[3] if row[3] != 'NULL' else '0'
            
            sql = """
                INSERT INTO "WordTheme" (name, "moduleClass", "order")
                VALUES ({}, {}, {})
                RETURNING id;
            """.format(
                escape_sql_string(name),
                escape_sql_string(module_class),
                order_val
            )
            
            try:
                result = run_psql_docker(db_config, sql)
                for line_result in result.split('\n'):
                    if line_result.strip().isdigit():
                        new_id = int(line_result.strip())
                        id_mapping[legacy_id] = new_id
                        count += 1
                        break
            except Exception as e:
                logger.warning("Failed to import word theme {}: {}".format(legacy_id, e))
    
    logger.info("Imported {} word themes".format(count))
    return id_mapping


def import_word_theme_relations(migration_dir, db_config, word_id_mapping, theme_id_mapping):
    """Import word theme relations."""
    logger.info("Importing Word Theme Relations...")
    csv_file = os.path.join(migration_dir, 'word_theme_relations.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return
    
    count = 0
    skipped = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith('--') or not line.strip():
                continue
            
            row = parse_csv_line(line)
            if not row or len(row) < 4:
                continue
            
            legacy_word_id = int(row[1])
            legacy_theme_id = int(row[2])
            
            if legacy_word_id not in word_id_mapping or legacy_theme_id not in theme_id_mapping:
                skipped += 1
                continue
            
            order_val = row[3] if row[3] != 'NULL' else '0'
            
            sql = """
                INSERT INTO "WordThemeRelation" ("wordId", "themeId", "order")
                VALUES ({}, {}, {});
            """.format(
                word_id_mapping[legacy_word_id],
                theme_id_mapping[legacy_theme_id],
                order_val
            )
            
            try:
                run_psql_docker(db_config, sql)
                count += 1
                if count % 1000 == 0:
                    logger.info("Imported {} word theme relations...".format(count))
            except Exception as e:
                skipped += 1
                if 'unique' not in str(e).lower():
                    logger.warning("Failed to import relation: {}".format(e))
    
    logger.info("Imported {} word theme relations (skipped {} duplicates/errors)".format(count, skipped))


def main():
    migration_dir = os.getenv('STORAGEBOX_PATH', '/srv/storagebox') + '/content-migration'
    db_url = os.getenv('DATABASE_URL')
    
    if not db_url:
        logger.error("DATABASE_URL environment variable required")
        return 1
    
    if not os.path.exists(migration_dir):
        logger.error("Migration directory not found: {}".format(migration_dir))
        return 1
    
    db_config = parse_db_url(db_url)
    logger.info("=" * 60)
    logger.info("Importing Content Data from Storagebox")
    logger.info("=" * 60)
    logger.info("Migration directory: {}".format(migration_dir))
    logger.info("Database: {}:{}".format(db_config['host'], db_config['port']))
    logger.info("=" * 60)
    
    try:
        # Import in correct order
        language_id_mapping = import_languages(migration_dir, db_config)
        grammar_course_id_mapping = import_grammar_courses(migration_dir, db_config, language_id_mapping)
        phonetics_course_id_mapping = import_phonetics_courses(migration_dir, db_config, language_id_mapping)
        songs_course_id_mapping = import_songs_courses(migration_dir, db_config, language_id_mapping)
        
        import_grammar_lessons(migration_dir, db_config, grammar_course_id_mapping)
        import_phonetics_lessons(migration_dir, db_config, phonetics_course_id_mapping)
        import_songs_lessons(migration_dir, db_config, songs_course_id_mapping)
        
        word_id_mapping = import_words(migration_dir, db_config, language_id_mapping)
        theme_id_mapping = import_word_themes(migration_dir, db_config)
        import_word_theme_relations(migration_dir, db_config, word_id_mapping, theme_id_mapping)
        
        logger.info("=" * 60)
        logger.info("Import completed successfully!")
        logger.info("=" * 60)
        
        # Validate
        logger.info("Validating import...")
        validation_sql = """
            SELECT 'Language' as table_name, COUNT(*) as count FROM "Language"
            UNION ALL SELECT 'GrammarCourse', COUNT(*) FROM "GrammarCourse"
            UNION ALL SELECT 'GrammarLesson', COUNT(*) FROM "GrammarLesson"
            UNION ALL SELECT 'PhoneticsCourse', COUNT(*) FROM "PhoneticsCourse"
            UNION ALL SELECT 'PhoneticsLesson', COUNT(*) FROM "PhoneticsLesson"
            UNION ALL SELECT 'SongsCourse', COUNT(*) FROM "SongsCourse"
            UNION ALL SELECT 'SongsLesson', COUNT(*) FROM "SongsLesson"
            UNION ALL SELECT 'Word', COUNT(*) FROM "Word"
            UNION ALL SELECT 'WordTheme', COUNT(*) FROM "WordTheme"
            UNION ALL SELECT 'WordThemeRelation', COUNT(*) FROM "WordThemeRelation"
            ORDER BY table_name;
        """
        result = run_psql_docker(db_config, validation_sql)
        logger.info("\n" + result)
        
        return 0
    except Exception as e:
        logger.error("Import failed: {}".format(e), exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
