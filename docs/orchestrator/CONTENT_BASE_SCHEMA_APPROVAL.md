# Content-Service Base Schema Readiness Approval Packet

Date: 2026-06-13
Status: approval required; target `speakasap_content_db` is reachable but currently empty.

## Request

Approve applying the existing content-service Prisma migrations to the Kubernetes-backed `speakasap_content_db` only for schema readiness, then immediately rerun DB-backed no-write reconciliation for the seven migration.

This approval is for schema objects only. It does not approve importing seven content rows, deploying services, mutating object storage, changing public traffic, or retiring any legacy route.

## Why This Is Needed

Fresh no-write target evidence showed:

- `/tmp/speakasap-seven-dry-run-target-v14.json`: `writes=false`, `target.checked=true`, blocking issue `TARGET_LANGUAGE_TABLE_UNAVAILABLE`.
- Read-only information_schema inventory: public tables `[]`; `_prisma_migrations` absent.

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
kubectl -n statex-apps port-forward svc/db-server-postgres 15436:5432
```

In a separate remote shell with the port-forward active:

```bash
cd /home/ssf/Documents/Github/speakasap/content-service
DATABASE_URL="$(kubectl get secret speakasap-content-secret -n statex-apps -o jsonpath='{.data.DATABASE_URL}' | base64 -d | sed 's/@db-server-postgres:5432/@127.0.0.1:15436/')" npm run prisma:migrate:deploy
```

This command applies all pending content-service Prisma migrations in order. Given the current empty target DB, that means the base init migration and the seven schema migration. Stop the temporary port-forward immediately after verification commands finish.

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

Without that explicit approval, do not run `npm run prisma:migrate:deploy` against the target content database.
