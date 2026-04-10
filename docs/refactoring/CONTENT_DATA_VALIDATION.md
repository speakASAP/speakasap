# Content Data Migration Validation Report

## Production validation — 2026-04-10

**Validator:** Cursor agent (post-import on alfares)  
**Status:** Passed

### Record count comparison

| Table | Legacy (export) | New (Postgres) | Match |
|-------|----------------:|---------------:|:-----:|
| Language | 19 | 19 | Yes |
| GrammarCourse | 19 | 19 | Yes |
| GrammarLesson | 522 | 522 | Yes |
| PhoneticsCourse | 2 | 2 | Yes |
| PhoneticsLesson | 20 | 20 | Yes |
| SongsCourse | 8 | 8 | Yes |
| SongsLesson | 137 | 137 | Yes |
| Word | 20878 | 20878 | Yes |
| WordTheme | 1138 | 1138 | Yes |
| WordThemeRelation | 32716 | 32716 | Yes |

Script log: `OK` for all keys; duplicates skipped: 0 for words and relations on this run.

### Sample record (API)

**Endpoint:** `GET http://127.0.0.1:4204/api/v1/languages` (green content-service on alfares at time of validation)

**HTTP status:** 200 OK

**Sample item (truncated):** first language `code` `en`, `machineName` `english`, `name` `английский`, `iconUrl` points at `https://assets.alfares.cz/languages/...`, fields align with camelCase Prisma schema.

### Relationship validation

Import order enforced by script: languages → courses → lessons → dictionary (`Word`, `WordTheme`, `WordThemeRelation`). Full load committed in one transaction; no FK errors reported.

### API endpoint checks (alfares)

| Endpoint | Status |
|----------|--------|
| `/api/v1/languages` | 200, JSON list non-empty |

*Optional follow-up:* `grammar`, `phonetics`, `songs`, `dictionary` — spot-check as needed.

### Discrepancies

None for this run.

### Conclusion

Content migration from legacy Django export to `speakasap_content_db` completed with exact count parity and successful languages API response on the deployed content service port.

---

## AGENT14 note (theory)

Post-migration counts from `validate_migration()` are exact matches when there are no skipped rows (orphan FKs) and no duplicate skips on `Word` / `WordThemeRelation`. If legacy duplicates exist, expect `MISMATCH` on `words` or `word_theme_relations`; use `migration.log` skipped counts.

---

## Template — future validations

**Date:** [Date]  
**Validator:** [Name]  
**Status:** [Passed/Failed/Partial]

(Fill record table, samples, and curl results per run.)
