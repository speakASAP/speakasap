# Notification data migration validation (TASK-52 / P4-ND)

## Mapping (single source of truth)

Legacy → target tables, columns, and **TASK-52 ETL semantics** (including `managerUserId`, `bodyHtml`, and out-of-scope rows) are defined only in **`NOTIFICATION_DATA_MAPPING.md`**. This file documents how to **run and verify** the migration; do not duplicate mapping tables here.

## Idempotency and dry-run

- **Dry-run:** connects to **legacy only**, prints JSON logs with counts; **no** writes to `NOTIFICATION_DATABASE_URL`.
- **Load:** upserts groups/templates/preferences/common settings/in-app rows/letters; replaces **only** `template_groups` and `notification_group_managers` rows for templates/groups touched in this run (full replace per migrated template/group UUID set). Re-running **load** with the same legacy snapshot refreshes bodies and metadata.

## Rollback

- **Target DB:** restore `speakasap_notification_db` from a snapshot taken **before** `--load`, or truncate affected tables in reverse FK order (letters → template_preferences → template_groups → templates; group_managers → groups; etc.). There is no in-script down-migration.
- **Legacy:** read-only; no rollback on source.

## Orphans and warnings

- Letters whose `template_id` is missing in legacy templates are **skipped** (counted in logs / `--write-docs` JSON).
- Template preferences with missing template FK are **skipped**.
- Missing HTML file for a `machine_name`: `bodyHtml` gets an HTML comment placeholder; `template_body_missing_file` log line.

## Legacy template tokens (Django → stored `bodyHtml`)

- Files are copied **as-is** from Django template paths (Django `{% %}` / `{{ }}` and context keys such as `view_on_site_url`, `user`, `scheme` remain in HTML until templates are edited in notification-service).
- API contract (`NOTIFICATION_API_CONTRACT.md`) uses **camelCase** keys in **dispatch `context`** (e.g. `viewOnSiteUrl`); renderer migration to `{{variableName}}` is a **separate** editorial step — this ETL does not rewrite template syntax automatically.

## Commands

```bash
cd notification-service
npm install
npm run migrate:notification-data -- --dry-run
npm run migrate:notification-data -- --load
npm run migrate:notification-data -- --verify-post-load
```

Env: `NOTIFICATION_LEGACY_DATABASE_URL`, `NOTIFICATION_DATABASE_URL` (see `speakasap/.env.example`). Optional `NOTIFICATION_PORTAL_ROOT`.

## P4-ND checklist

| Check | Pass criteria |
| --- | --- |
| Script | `notification-service/scripts/migrate-notification-data.ts` exists |
| Docs | This file + `NOTIFICATION_DATA_MIGRATION_LOG.md` present |
| Secrets | No passwords/URLs in committed docs; ETL reads credentials from env only |
| Dry-run | `--dry-run` performs no target DB writes |
| Rerun | Second `--load` completes without unique violations; counts stable for unchanged legacy |
