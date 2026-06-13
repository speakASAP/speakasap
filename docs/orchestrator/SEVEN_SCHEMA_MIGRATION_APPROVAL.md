# Seven Schema Migration Approval Packet

Date: 2026-06-13
Status: blocked by target base content schema readiness; no schema migration or seven data apply has run.


## 2026-06-13 Target Base Schema Finding

Fresh DB-backed target dry-run `/tmp/speakasap-seven-dry-run-target-v14.json` found that the Kubernetes-backed `speakasap_content_db` is reachable but currently has no public tables and no `_prisma_migrations` history. The required base content table `Language` does not exist, so applying only `20260613110000_seven_content` would fail on the `SevenCourse_languageId_fkey` foreign key.

Before this packet can be used for the seven schema migration, the content-service base schema must be applied or otherwise proven present. The next approval must cover base content schema readiness first, then the seven schema migration, still with no seven data apply.

Read-only evidence:

- `/tmp/speakasap-seven-dry-run-target-v14.json`: `writes=false`, `target.checked=true`, blocking issue `TARGET_LANGUAGE_TABLE_UNAVAILABLE`, planned language codes `19`, and expected seven table errors.
- Read-only information_schema inventory through temporary port-forward `15440`: public tables `[]`, `_prisma_migrations` absent.

## Request

After base content schema readiness is approved and verified, approve applying only the seven content schema migration `content-service/prisma/migrations/20260613110000_seven_content/migration.sql` to the Kubernetes-backed `speakasap_content_db`.

This approval is only for creating the empty seven content tables and indexes. It does not approve importing seven course data, deploying services, mutating object storage, changing public traffic, or retiring any legacy route.

## Preserved Intent

The seven-lesson course remains public learning content for online language education. The schema creates a service-owned target for legacy seven course, lesson, exercise, answer, media-reference, SEO, app-link, and typography-preserving rendered HTML data. Private student progress, payments, final tests, teacher workflows, and legacy route retirement remain outside this approval.

## Scope

In scope:

- Create `SevenCourse`.
- Create `SevenLesson`.
- Create `SevenExercise`.
- Create uniqueness/index constraints for legacy IDs, course lesson order, exercise legacy keys, and exercise order.
- Add foreign keys from seven tables to `Language`, `SevenCourse`, and `SevenLesson`.
- Record the migration in Prisma's migration table through the normal content-service migration mechanism.

Out of scope:

- No migrated seven data insert/update/upsert.
- No frontend, gateway, or content-service deployment.
- No object storage mutation or media copy.
- No legacy `speakasap-portal` route retirement.
- No assessment/final-test migration.

## Current Evidence

Fresh no-write source and target reports:

- `/tmp/speakasap-seven-dry-run-v12.json`: `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and 4 expected warnings.
- `/tmp/speakasap-seven-dry-run-target-v12.json`: `writes=false`, target DB reachable, planned legacy course/lesson/exercise IDs or keys `19/136/429`, no blocking issues, expected missing target tables before schema migration.

Payload metadata evidence:

- Legacy Android app URL coverage: `18` course rows.
- Legacy iOS app URL coverage: `17` course rows.
- Structured media refs: `136` lesson rows, `408` exercise rows, `1104` unique refs.
- Genitive language metadata exists for all 19 seven courses.

Build/static evidence already recorded in `docs/orchestrator/STATUS.md`:

- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- `cd api-gateway && npm run build` passed after gateway seven route work.
- `cd frontend && npm run build` passed after seven frontend work.
- Browser QA against mock data passed for app promo, PDF href, answer disclosure, and legacy text typography.

## Proposed Apply Command

Run on `alfares` from `/home/ssf/Documents/Github/speakasap` only after owner approval:

```bash
cd /home/ssf/Documents/Github/speakasap
kubectl -n statex-apps port-forward svc/db-server-postgres 15436:5432
```

In a separate remote shell with the port-forward active:

```bash
cd /home/ssf/Documents/Github/speakasap/content-service
DATABASE_URL="$(kubectl get secret speakasap-content-secret -n statex-apps -o jsonpath='{.data.DATABASE_URL}' | base64 -d | sed 's/@db-server-postgres:5432/@127.0.0.1:15436/')" npm run prisma:migrate:deploy
```

Immediately stop the temporary port-forward after the command.

## Required Post-Apply Verification

Before any data apply approval is considered, run:

```bash
cd /home/ssf/Documents/Github/speakasap
CONTENT_TARGET_DATABASE_URL="$(kubectl get secret speakasap-content-secret -n statex-apps -o jsonpath='{.data.DATABASE_URL}' | base64 -d | sed 's/@db-server-postgres:5432/@127.0.0.1:15436/')" \
  content-service/scripts/migrate-seven-from-legacy.py --check-target --json-report /tmp/speakasap-seven-dry-run-target-post-schema-v1.json
```

Expected post-schema result before data apply:

- `writes=false`.
- Target counts exist for `SevenCourse`, `SevenLesson`, and `SevenExercise`.
- Expected counts for those new tables are `0` before data apply.
- Planned IDs/keys remain `19/136/429`.
- No blocking issues.

## Rollback Plan

Rollback applies only if the schema migration succeeds and no seven data has been imported yet. If any seven rows exist, stop and create a separate data rollback plan first.

Pre-rollback check:

```sql
SELECT COUNT(*) AS courses FROM "SevenCourse";
SELECT COUNT(*) AS lessons FROM "SevenLesson";
SELECT COUNT(*) AS exercises FROM "SevenExercise";
```

Rollback SQL for empty seven tables:

```sql
BEGIN;
DROP TABLE IF EXISTS "SevenExercise";
DROP TABLE IF EXISTS "SevenLesson";
DROP TABLE IF EXISTS "SevenCourse";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260613110000_seven_content';
COMMIT;
```

After rollback, rerun the DB-backed no-write target report and expect the same missing-table evidence as `/tmp/speakasap-seven-dry-run-target-v12.json`.

## Approval Boundary

Required owner approval wording should be explicit, for example:

> Approved to apply only `content-service/prisma/migrations/20260613110000_seven_content/migration.sql` to the Kubernetes content database, then run DB-backed no-write reconciliation. No seven data apply, deploy, object mutation, or legacy route retirement is approved.

Without explicit approval for base content schema readiness and the seven schema migration, do not run `npm run prisma:migrate:deploy` against the target database. Do not apply seven data until a post-schema DB-backed no-write report proves `Language`, `SevenCourse`, `SevenLesson`, and `SevenExercise` readiness.
