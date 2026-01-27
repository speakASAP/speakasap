#!/usr/bin/env python3
"""
Import content data from storagebox CSV files using psql
Does not require psycopg2 or Django - uses subprocess to call psql
"""

import os
import sys
import subprocess
import logging
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def parse_db_url(db_url):
    """Parse DATABASE_URL into components."""
    parsed = urlparse(db_url)
    return {
        'user': parsed.username,
        'password': parsed.password,
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'database': parsed.path.lstrip('/')
    }


def run_psql(db_config, sql_command):
    """Execute SQL command using psql."""
    env = os.environ.copy()
    if db_config['password']:
        env['PGPASSWORD'] = db_config['password']
    
    cmd = [
        'psql',
        '-h', db_config['host'],
        '-p', str(db_config['port']),
        '-U', db_config['user'],
        '-d', db_config['database'],
        '-c', sql_command
    ]
    
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("psql error: {}".format(result.stderr))
        raise RuntimeError("psql failed: {}".format(result.stderr))
    return result.stdout


def import_languages(migration_dir, db_config):
    """Import languages from CSV file."""
    logger.info("Importing Languages...")
    csv_file = os.path.join(migration_dir, 'languages.sql')
    
    if not os.path.exists(csv_file):
        logger.error("File not found: {}".format(csv_file))
        return {}
    
    id_mapping = {}
    count = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            if line.strip().startswith('--') or not line.strip():
                continue
            
            # Parse CSV line: id,code,machine_name,name,icon_path,order,speaker
            parts = line.strip().split(',')
            if len(parts) < 7:
                continue
            
            legacy_id = int(parts[0])
            code = parts[1].strip("'")
            machine_name = parts[2].strip("'")
            name = parts[3].strip("'")
            icon_path = parts[4].strip("'")
            order_val = parts[5] if parts[5] != 'NULL' else '0'
            speaker = parts[6].strip("'") if len(parts) > 6 and parts[6] != 'NULL' else 'носитель'
            
            # Escape single quotes in SQL
            code = code.replace("'", "''")
            machine_name = machine_name.replace("'", "''")
            name = name.replace("'", "''")
            icon_path = icon_path.replace("'", "''")
            speaker = speaker.replace("'", "''")
            
            sql = """
                INSERT INTO "Language" (code, "machineName", name, "iconPath", "order", speaker)
                VALUES ('{}', '{}', '{}', '{}', {}, '{}')
                RETURNING id
            """.format(code, machine_name, name, icon_path, order_val, speaker)
            
            try:
                result = run_psql(db_config, sql)
                # Extract ID from result (format: " id \n----\n  1 \n(1 row)\n")
                new_id = int(result.split('\n')[2].strip())
                id_mapping[legacy_id] = new_id
                count += 1
            except Exception as e:
                logger.warning("Failed to import language {}: {}".format(legacy_id, e))
    
    logger.info("Imported {} languages".format(count))
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
            
            parts = line.strip().split(',')
            if len(parts) < 6:
                continue
            
            legacy_id = int(parts[0])
            legacy_lang_id = int(parts[5])
            
            if legacy_lang_id not in language_id_mapping:
                continue
            
            title = parts[1].strip("'").replace("'", "''")
            material_lang = parts[2].strip("'") if parts[2] != 'NULL' else 'ru'
            meta_keywords = parts[3].strip("'").replace("'", "''") if parts[3] != 'NULL' else 'NULL'
            meta_description = parts[4].strip("'").replace("'", "''") if parts[4] != 'NULL' else 'NULL'
            
            sql = """
                INSERT INTO "GrammarCourse" (title, "materialLanguage", "metaKeywords", "metaDescription", "languageId")
                VALUES ('{}', '{}', {}, {}, {})
                RETURNING id
            """.format(
                title, material_lang,
                "'{}'".format(meta_keywords) if meta_keywords != 'NULL' else 'NULL',
                "'{}'".format(meta_description) if meta_description != 'NULL' else 'NULL',
                language_id_mapping[legacy_lang_id]
            )
            
            try:
                result = run_psql(db_config, sql)
                new_id = int(result.split('\n')[2].strip())
                id_mapping[legacy_id] = new_id
                count += 1
            except Exception as e:
                logger.warning("Failed to import grammar course {}: {}".format(legacy_id, e))
    
    logger.info("Imported {} grammar courses".format(count))
    return id_mapping


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
    logger.info("Importing from: {}".format(migration_dir))
    logger.info("Database: {}:{}".format(db_config['host'], db_config['port']))
    
    # Import in order
    language_id_mapping = import_languages(migration_dir, db_config)
    grammar_course_id_mapping = import_grammar_courses(migration_dir, db_config, language_id_mapping)
    
    logger.info("Import completed!")
    return 0


if __name__ == '__main__':
    sys.exit(main())
