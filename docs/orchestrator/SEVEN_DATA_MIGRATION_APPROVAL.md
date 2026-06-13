# Seven Content Data Migration Approval Packet

Date: 2026-06-13
Status: draft approval packet; do not run until schema readiness and DB-backed no-write reconciliation pass.

## Request

After the content-service base schema and seven schema exist in the Kubernetes-backed `speakasap_content_db`, approve one write-gated data apply that imports only the legacy seven-course public content needed for the frontend:

- `19` `Language` rows required by the migrated seven courses, from `speakasap-portal/portal/fixtures/languages.yaml`.
- `19` `SevenCourse` rows from `speakasap-portal/portal/fixtures/seven.xml`.
- `136` `SevenLesson` rows with rendered legacy lesson HTML.
- `429` `SevenExercise` rows with rendered exercise/answer HTML.

This approval must not include deployment, object storage mutation, media copy, final test/assessment migration, private learner progress, paid-course product changes, or legacy route retirement.

## Preconditions

Before this data apply can be approved:

- `CONTENT_BASE_SCHEMA_APPROVAL.md` must be approved and completed.
- A post-schema DB-backed no-write report must show `Language`, `SevenCourse`, `SevenLesson`, and `SevenExercise` are queryable.
- The importer report must still show `writes=false`, planned payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, and no source blocking issues.
- If `Language` rows are missing, approval must explicitly allow `--include-languages` so the importer can seed/update only the 19 legacy language rows required by seven courses.

## Proposed Command

Run on `alfares` from `/home/ssf/Documents/Github/speakasap` only after explicit owner approval and only with a fresh DB-backed no-write report:

```bash
cd /home/ssf/Documents/Github/speakasap
kubectl -n statex-apps port-forward svc/db-server-postgres 15442:5432
```

In a separate remote shell with the port-forward active:

```bash
cd /home/ssf/Documents/Github/speakasap
export CONTENT_TARGET_DATABASE_URL="$(kubectl get secret speakasap-content-secret -n statex-apps -o jsonpath='{.data.DATABASE_URL}' | base64 -d | sed 's/@db-server-postgres:5432/@127.0.0.1:15442/')"
content-service/scripts/migrate-seven-from-legacy.py --check-target --apply --include-languages --confirm-write --approval-note "OWNER_APPROVAL_TEXT" --rollback-plan /tmp/speakasap-seven-content-rollback-v1.sql --json-report /tmp/speakasap-seven-content-apply-v1.json
```

Stop the temporary port-forward immediately after post-apply verification commands finish.

## Required Post-Apply Verification

After apply, rerun no-write reconciliation:

```bash
export CONTENT_TARGET_DATABASE_URL="$(kubectl get secret speakasap-content-secret -n statex-apps -o jsonpath='{.data.DATABASE_URL}' | base64 -d | sed 's/@db-server-postgres:5432/@127.0.0.1:15442/')"
content-service/scripts/migrate-seven-from-legacy.py --check-target --json-report /tmp/speakasap-seven-content-post-apply-v1.json
```

Expected result:

- `writes=false`.
- `target.checked=true`.
- Existing planned matches: `19` course legacy IDs, `136` lesson legacy IDs, and `429` exercise legacy keys.
- Existing language codes cover the `19` planned seven course languages.
- No blocking issues.

## Rollback Boundary

Rollback SQL is generated before writes. It deletes only migrated `SevenExercise`, `SevenLesson`, and `SevenCourse` rows by legacy keys/IDs. If `--include-languages` is used, it also deletes the 19 seeded `Language` rows only when no content tables still reference them.

Do not run rollback without fresh owner approval and a data-aware check of dependent rows.

## Required Approval Wording

Use explicit wording like:

> Approved to run the seven content data apply against the Kubernetes content database with `--include-languages`, importing only the 19 language rows, 19 seven courses, 136 seven lessons, and 429 seven exercises from the legacy portal evidence. No deployment, object mutation, media copy, final test migration, private progress migration, paid-product change, or legacy route retirement is approved.

Without that explicit approval, do not run `--apply` against the target content database.
