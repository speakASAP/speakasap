# Auth Bootstrap Apply Gate

Date: 2026-06-12

Status: applied and deployed.

## Implemented In Auth Microservice

Files:

- `/home/ssf/Documents/Github/auth-microservice/scripts/bootstrap-speakasap-legacy-users.ts`
- `/home/ssf/Documents/Github/auth-microservice/src/auth/auth.service.ts`
- `/home/ssf/Documents/Github/auth-microservice/src/auth/auth.module.ts`
- `/home/ssf/Documents/Github/auth-microservice/src/users/entities/legacy-identity-mapping.entity.ts`
- `/home/ssf/Documents/Github/auth-microservice/shared/database/database.module.ts`

Implemented policy:

- `--apply` cannot be combined with `--dry-run`.
- `--apply` requires `--confirm-write`.
- `--apply` requires `--approval-note`.
- Only `--password-policy legacy-pbkdf2-upgrade` is supported.
- Writes run inside one auth database transaction.
- New target auth users are created with `password = NULL` and `source = 'speakasap-portal'`.
- Legacy Django password hashes are stored only in `legacy_identity_mappings.legacyPasswordHash`.
- `AuthService.login` can verify `pbkdf2_sha256$...` legacy hashes.
- On first successful legacy-password login, auth writes a bcrypt password through `UsersService.updatePassword` and clears the legacy hash from the mapping row.
- Duplicate legacy email rows are preserved as distinct auth users with `email = NULL` and `status = 'created_duplicate_email'`; login lookup uses `legacy_identity_mappings.normalizedEmail`.
- Upsert logic preserves `legacyPasswordMigratedAt` so reruns do not reintroduce a cleared legacy hash.

## Dry-Run Evidence

Final no-write report before apply:

- `/tmp/speakasap-auth-bootstrap-dry-run-v5.json`

Summary:

- `mode=dry-run`
- `writes=false`
- password policy: `legacy-pbkdf2-upgrade`
- legacy users: `214230`
- target auth users before apply: `22`
- duplicate email groups: `95`
- duplicate email rows: `192`
- existing target email matches: `6`
- create candidates: `214032`
- duplicate email candidates: `192`
- planned user writes: `214224`
- planned mapping writes: `214230`

## Apply Evidence

Apply was run only after explicit owner approval using:

```bash
npx ts-node scripts/bootstrap-speakasap-legacy-users.ts \
  --apply \
  --confirm-write \
  --approval-note "User approved legacy SpeakASAP auth bootstrap with Django PBKDF2 password continuity on 2026-06-12" \
  --password-policy legacy-pbkdf2-upgrade \
  --json-report /tmp/speakasap-auth-bootstrap-apply-v1.json \
  --rollback-plan /tmp/speakasap-auth-bootstrap-rollback-apply-v1.sql \
  --limit 10
```

The write transaction committed. The post-commit report process was stopped because it became slow while comparing against the newly enlarged target email index; focused verification queries were used instead.

## Post-Apply Verification

Auth database verification:

- total auth users: `214246`
- new `speakasap-portal` source users: `214224`
- `speakasap-portal` source users with null primary email: `192`
- `speakasap-portal` source users with password set in `users.password`: `0`
- legacy mappings: `214230`
- mappings with auth user: `214230`
- mappings with stored legacy password hash: `214230`
- mappings with migrated password timestamp: `0`
- mapping statuses:
  - `created`: `214032`
  - `created_duplicate_email`: `192`
  - `mapped`: `6`
- unmapped `speakasap-portal` source users: `0`

Deployment verification:

- image: `localhost:5000/auth-microservice:b616818-20260612093355`
- namespace: `statex-apps`
- rollout completed successfully.
- final health check returned `success=true`, `status=ok`, `service=auth-microservice`.

## Rollback Boundary

Rollback SQL artifacts:

- `/tmp/speakasap-auth-bootstrap-rollback-v5.sql`
- `/tmp/speakasap-auth-bootstrap-rollback-apply-v1.sql` was requested, but the post-commit report process was stopped before it wrote the apply artifact.

Rollback intent:

- Delete auth users created by this bootstrap through `legacy_identity_mappings.status IN ('created', 'created_duplicate_email')` and `users.source = 'speakasap-portal'`.
- Delete SpeakASAP legacy mapping rows with `legacySystem = 'speakasap-portal'`.
- Preserve pre-existing target auth users.

If rollback is ever needed after real user logins have occurred, review first-login upgraded bcrypt passwords before deleting rows. The migration design expects rollback to be a controlled owner-approved operation, not an automatic command.

## Next Work

Goal 4.11 must update user/profile migration to resolve auth IDs from `legacy_identity_mappings` by legacy `auth_user.id`. Email-only target auth resolution is now insufficient because duplicate legacy emails are intentionally represented as distinct null-email auth users.
