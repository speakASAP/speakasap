# Content-Service Base Schema Readiness Approval Packet

Date: 2026-06-13
Status: approval required; target `speakasap_content_db` is reachable but currently empty.

## Request

Approve applying the existing content-service Prisma migrations to the Kubernetes-backed `speakasap_content_db` only for schema readiness, then immediately rerun DB-backed no-write reconciliation for the seven migration.

This approval is for schema objects only. It does not approve importing seven content rows, deploying services, mutating object storage, changing public traffic, or retiring any legacy route.

## Why This Is Needed

Fresh no-write target evidence showed:

- `/tmp/speakasap-seven-post-schema-reconciliation-fresh-v1.json`: `writes=false`, `ok=false`, `schemaReady=false`, `dataReady=false`.
- The current target correctly fails post-schema acceptance before approval because `Language`, `SevenCourse`, `SevenLesson`, and `SevenExercise` are not queryable yet, while planned counts remain `19/136/429`.
- Earlier read-only information_schema inventory showed public tables `[]`; `_prisma_migrations` absent.

The seven migration `20260613110000_seven_content` has a foreign key from `SevenCourse.languageId` to `Language.id`. Because the base `Language` table does not exist, applying only the seven migration would fail.

## Base Schema Scope

The existing base migration `content-service/prisma/migrations/20260127161203_init/migration.sql` creates these empty schema objects:

- `Language`
- `GrammarCourse`, `GrammarLesson`
- `PhoneticsCourse`, `PhoneticsLesson`
- `SongsCourse`, `SongsLesson`
- `Word`, `WordTheme`, `WordThemeRelation`
- Indexes and foreign keys for those tables
- Prisma migration history through `_prisma_migrations`

The existing seven migration `content-service/prisma/migrations/20260613110000_seven_content/migration.sql` creates:

- `SevenCourse`
- `SevenLesson`
- `SevenExercise`
- Indexes and foreign keys for those tables

No-write static schema-plan evidence:

- `/tmp/speakasap-seven-schema-migration-plan-v10.json`: `writes=false`, `ok=true`, expected base and seven migrations present, expected tables/indexes/foreign keys present, destructive DDL/DML statements absent, required Prisma seven models/relations present, safe direct Prisma execution contract verified, and active approval evidence references next-gate/no-write suite freshness.
- `/tmp/speakasap-seven-next-gate-v1.json`: `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `nextGate=schema`, `nextGateRequestable=true`, next approval packet `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, and next operator `scripts/apply-seven-schema-approved.sh --execute`.
- `/tmp/speakasap-seven-no-write-suite-v19.json`: `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`, and embedded next-gate summary `nextGate=schema`.

## Out Of Scope

- No seven course/lesson/exercise data import.
- No grammar, phonetics, songs, or word content data import.
- No frontend, gateway, or content-service deployment.
- No object storage mutation or media copy.
- No legacy `speakasap-portal` route retirement.
- No final test/assessment migration.

## Proposed Command

Run on `alfares` from `/home/ssf/Documents/Github/speakasap` only after explicit owner approval:

```bash
cd /home/ssf/Documents/Github/speakasap
SEVEN_SCHEMA_APPROVAL_TEXT='Approved to apply pending content-service Prisma migrations to the Kubernetes content database for base schema readiness and seven schema creation only, then run DB-backed no-write reconciliation. No seven data apply, deploy, object mutation, or legacy route retirement is approved.' \
  scripts/apply-seven-schema-approved.sh --execute
```

The gated operator script refuses to run without `--execute` and an exact `SEVEN_SCHEMA_APPROVAL_TEXT` match. It opens the temporary port-forward, derives `DATABASE_URL` from the Kubernetes content secret, runs `npx prisma migrate deploy --schema prisma/schema.prisma`, then immediately runs the DB-backed no-write target report and `check-seven-post-schema-reconciliation.py`. The target report may return non-zero when the expected post-schema language seed gap is present, but the operator continues only if the report file was written and lets the reconciliation checker decide schema readiness. It records `/tmp/speakasap-seven-schema-apply-execution-v1.json` with the approval text hash, migration log path, target report path, reconciliation report path, and explicit false flags for later data/media/deploy/legacy-retirement approvals.

This command applies all pending content-service Prisma migrations in order. Given the current empty target DB, that means the base init migration and the seven schema migration. It intentionally avoids the package-script migration wrapper because that script sources `../.env` after the inline environment is set, which can override the Kubernetes secret-derived `DATABASE_URL` on hosts where root `.env` exists. The temporary port-forward is stopped automatically when the script exits.

## Required Post-Apply No-Write Verification

Before any data apply approval is considered, run a DB-backed no-write seven report:

```bash
cd /home/ssf/Documents/Github/speakasap
CONTENT_TARGET_DATABASE_URL="$(kubectl get secret speakasap-content-secret -n statex-apps -o jsonpath='{.data.DATABASE_URL}' | base64 -d | sed 's/@db-server-postgres:5432/@127.0.0.1:15436/')" \
  content-service/scripts/migrate-seven-from-legacy.py --check-target --json-report /tmp/speakasap-seven-dry-run-target-post-schema-v1.json
```

Expected post-schema result before data apply:

- `writes=false`.
- `target.checked=true`.
- `Language`, `SevenCourse`, `SevenLesson`, and `SevenExercise` are queryable.
- `SevenCourse=0`, `SevenLesson=0`, `SevenExercise=0` before data apply.
- Planned IDs/keys remain `19/136/429`.
- No `TARGET_LANGUAGE_TABLE_UNAVAILABLE` blocking issue.
- If target `Language` has no rows, this is still not ready for seven data apply; use the separate `SEVEN_DATA_MIGRATION_APPROVAL.md` gate, which can explicitly allow `--include-languages` for only the 19 legacy language rows required by seven courses.

Then run the acceptance checker:

```bash
content-service/scripts/check-seven-post-schema-reconciliation.py \
  --target-report /tmp/speakasap-seven-dry-run-target-post-schema-v1.json \
  --json-report /tmp/speakasap-seven-post-schema-reconciliation-v1.json
```

Expected checker result:

- `writes=false`.
- `schemaReady=true`.
- `ok=true`.
- `complete=false` until data/media/deploy gates finish.
- If `Language` rows are missing, `dataReady=false` and the next gate remains `SEVEN_DATA_MIGRATION_APPROVAL.md` with explicit `--include-languages`.

## Rollback Boundary

Rollback is allowed only while all newly created content tables are empty. Check first:

```sql
SELECT COUNT(*) FROM "Language";
SELECT COUNT(*) FROM "SevenCourse";
SELECT COUNT(*) FROM "SevenLesson";
SELECT COUNT(*) FROM "SevenExercise";
```

If any count is non-zero, stop and create a data-aware rollback plan first.

Schema-only rollback for empty tables:

```sql
BEGIN;
DROP TABLE IF EXISTS "SevenExercise";
DROP TABLE IF EXISTS "SevenLesson";
DROP TABLE IF EXISTS "SevenCourse";
DROP TABLE IF EXISTS "WordThemeRelation";
DROP TABLE IF EXISTS "WordTheme";
DROP TABLE IF EXISTS "Word";
DROP TABLE IF EXISTS "SongsLesson";
DROP TABLE IF EXISTS "SongsCourse";
DROP TABLE IF EXISTS "PhoneticsLesson";
DROP TABLE IF EXISTS "PhoneticsCourse";
DROP TABLE IF EXISTS "GrammarLesson";
DROP TABLE IF EXISTS "GrammarCourse";
DROP TABLE IF EXISTS "Language";
DELETE FROM "_prisma_migrations"
WHERE migration_name IN ('20260127161203_init', '20260613110000_seven_content');
COMMIT;
```

After rollback, rerun the DB-backed no-write target report and expect `TARGET_LANGUAGE_TABLE_UNAVAILABLE` again.

## Required Approval Wording

Use explicit wording like:

> Approved to apply pending content-service Prisma migrations to the Kubernetes content database for base schema readiness and seven schema creation only, then run DB-backed no-write reconciliation. No seven data apply, deploy, object mutation, or legacy route retirement is approved.

Without that explicit approval, do not run `npx prisma migrate deploy --schema prisma/schema.prisma` against the target content database.
