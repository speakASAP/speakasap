# Auth Bootstrap Apply Gate

Date: 2026-06-12

Status: apply path implemented, not executed.

## Implemented In Auth Microservice

File: `/home/ssf/Documents/Github/auth-microservice/scripts/bootstrap-speakasap-legacy-users.ts`

Apply mode now exists, but is gated:

- `--apply` cannot be combined with `--dry-run`;
- `--apply` requires `--confirm-write`;
- `--apply` requires `--approval-note`;
- only `--password-policy reset-only` is supported;
- writes run inside one auth database transaction;
- duplicate legacy emails are not merged automatically; they are written as `skipped_duplicate_email` mapping rows when apply eventually runs;
- blank emails are written as `skipped_blank_email` mapping rows;
- new target auth users are created with `password = NULL`, `source = 'speakasap-portal'`, and no copied legacy password hash;
- existing target auth users are mapped by lower-trimmed email.

## Rollback Evidence

Dry-run rollback plan path:

- `/tmp/speakasap-auth-bootstrap-rollback.sql`

The rollback plan deletes:

- auth users created by the bootstrap, identified through `legacy_identity_mappings.status = 'created'` and `users.source = 'speakasap-portal'`;
- SpeakASAP legacy mapping rows with `legacySystem = 'speakasap-portal'`.

It preserves pre-existing target auth users.

## Dry-Run Evidence

Latest report path:

- `/tmp/speakasap-auth-bootstrap-dry-run-v3.json`

Summary:

- `mode=dry-run`
- `writes=false`
- planned user writes: `214032`
- planned mapping writes: `214230`
- actual users created: `0`
- actual mappings upserted: `0`
- duplicate email candidates: `192`
- existing target email matches: `6`

## Verification

Verified on `alfares`:

- help output lists dry-run and apply usage;
- no-mode execution refuses;
- `--apply` without `--confirm-write` refuses;
- `--apply --confirm-write` without `--approval-note` refuses;
- `npm run build` passes in `auth-microservice`;
- dry-run with `--rollback-plan` completes with `writes=false`.

## Not Yet Done

The auth bootstrap apply has not been executed. No auth users or legacy mapping rows have been written.

Before running apply:

1. Confirm the exact command and approval note.
2. Confirm the rollback SQL path and database backup/checkpoint expectations.
3. Run apply with `--apply --confirm-write --approval-note`.
4. Capture post-apply JSON.
5. Re-run `user-service/scripts/migrate-user-from-legacy.py --dry-run --check-target`.
