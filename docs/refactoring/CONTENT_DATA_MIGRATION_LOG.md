# Content Data Migration Log

## Production run — 2026-04-10

**Executor:** Cursor agent (SSH: `speakasap` → export, `alfares` → import)  
**Strategy:** File-based export/import per `content-service/scripts/README_MIGRATION.md`  
**Dry run:** Export path exercised on legacy; full import used `--truncate-first` on target after tarball transfer.

**Status:** Completed successfully.

### Environment (no secrets)

- **Legacy host:** `speakasap` — `/home/portal_db/speakasap-portal`, Python 3.4.3 (`/usr/bin/python3`)
- **Export directory:** `/home/portal_db/speakasap-content-export`
- **Archive:** `/tmp/speakasap-content-export.tgz` (transferred speakasap → operator → alfares)
- **Target:** `speakasap_content_db` on shared Postgres (`127.0.0.1:5432` from alfares host). `DATABASE_URL` must match the running content-service container / `content-service` deployment env (see `.env` on alfares — not committed).

### Script sync

- Canonical: `speakasap/content-service/scripts/migrate-content-data.py` (local repo → `scp` to `speakasap:/home/portal_db/speakasap-portal/migrate-content-data.py`)

### Execution summary

| Step | Result |
|------|--------|
| Export (`--export-dir`) | OK |
| Import (`--import-dir`, `--truncate-first`) | OK, single transaction commit |
| Post-import `validate_migration()` | All entity keys OK (legacy = new) |

### Record counts (legacy export = new DB after import)

| Entity | Count |
|--------|------:|
| Language | 19 |
| GrammarCourse | 19 |
| GrammarLesson | 522 |
| PhoneticsCourse | 2 |
| PhoneticsLesson | 20 |
| SongsCourse | 8 |
| SongsLesson | 137 |
| Word | 20878 |
| WordTheme | 1138 |
| WordThemeRelation | 32716 |

**Words skipped on import:** 0  
**WordThemeRelation skipped:** 0

### Errors

None.

### Next steps (ongoing)

- [ ] Re-run after major legacy content changes (same procedure)
- [ ] Spot-check UI / portal against content API

---

## Earlier maintenance note (AGENT14 tooling, 2026-04-09)

Script hardening: Django bootstrap (`SPEAKASAP_PORTAL_ROOT`), savepoints for duplicate `Word` / `WordThemeRelation`, validation table map, logging, `rollback-content-migration.sh`. Prior note that dry-run was not executed on Python 3.12 dev hosts is superseded by the production run above.

---

## Template — future runs

**Date:** [Date of migration]  
**Executor:** [Name/Agent]  
**Dry Run:** [Yes/No]  
**Status:** [In Progress/Completed/Failed]

### Environment

- **Legacy Database:** [redacted — portal Postgres]
- **New Database:** `speakasap_content_db` (URL from deployment only)
- **Migration script:** `speakasap/content-service/scripts/migrate-content-data.py`

### Preparation checklist

- [ ] Legacy database accessible
- [ ] New database created and Prisma migrations applied
- [ ] Data mapping reviewed (`CONTENT_DATA_MAPPING.md`)
- [ ] Script synced to portal host for export
- [ ] Optional dry-run on portal

### Rollback

- Target DB only: `content-service/scripts/rollback-content-migration.sh` (requires `DATABASE_URL`, confirms before `DROP SCHEMA`)
