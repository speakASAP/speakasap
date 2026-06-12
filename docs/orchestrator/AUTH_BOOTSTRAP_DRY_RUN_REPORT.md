# Auth Bootstrap Dry-Run Report

Date: 2026-06-12

Status: dry-run captured; no auth writes performed.

## Implementation

Implemented in `/home/ssf/Documents/Github/auth-microservice`:

- `scripts/bootstrap-speakasap-legacy-users.ts`
- `src/users/entities/legacy-identity-mapping.entity.ts`
- `shared/database/database.module.ts`

The script is dry-run only in this version:

- refuses to run without `--dry-run`;
- refuses `--apply`;
- supports `--json-report`;
- classifies password hash families without printing password hashes;
- masks email samples in the JSON report.

## Verification

Commands verified on `alfares`:

- `npx ts-node scripts/bootstrap-speakasap-legacy-users.ts --help`
- `npx ts-node scripts/bootstrap-speakasap-legacy-users.ts` refuses without `--dry-run`
- `npx ts-node scripts/bootstrap-speakasap-legacy-users.ts --dry-run --apply` refuses apply mode
- `npm run build` passes in `auth-microservice`
- dry-run report written to `/tmp/speakasap-auth-bootstrap-dry-run.json`

## Report Summary

Report path: `/tmp/speakasap-auth-bootstrap-dry-run.json`

- `writes=false`
- `passwordPolicy=reset-only`
- legacy users: `214230`
- legacy active users: `213474`
- legacy users with last login: `159436`
- target auth users: `22`
- target auth users with password: `17`
- legacy duplicate email groups: `95`
- legacy rows in duplicate email groups: `192`
- max duplicate group size: `3`
- password families:
  - `django_pbkdf2_sha256`: `212415`
  - `django_unusable_password`: `1815`
- existing target email matches: `6`
- create candidates: `214032`
- duplicate email candidates: `192`
- blank email skips: `0`
- planned user writes in dry run: `0`
- planned mapping writes in dry run: `0`

## Interpretation

The first auth-owned implementation step is in place and verified. It gives a repeatable report for owner review without modifying the auth database.

The next step is still write-gated:

- approve duplicate-email handling for the `192` duplicate candidates;
- approve whether apply mode should create users with `password = NULL`;
- add an explicit backup/rollback step before any auth write execution.
