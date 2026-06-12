# Auth Bootstrap Implementation Plan

Status: prepared, not approved for implementation.

This plan is the execution detail for Goal 4.9 after owner approval. It does not authorize code changes or writes by itself.

## Boundary

Implementation must happen inside `/home/ssf/Documents/Github/auth-microservice` because `auth-microservice` owns identity, JWTs, and the `users` table.

SpeakASAP migration scripts must only consume the resulting auth-owned mapping. They must not create auth users, invent auth UUIDs, or write directly to auth tables.

## Current Auth Repo Pattern

- Runtime: NestJS + TypeORM.
- Database config: `shared/database/database.module.ts`.
- Current entities are registered directly in `TypeOrmModule.forRoot`.
- `DB_SYNC=true` can synchronize entities, but production schema changes should still be explicit and reviewed.
- Existing scripts are TypeScript/Nest application-context scripts, for example `scripts/seed-rbac.ts`, plus shell wrappers.

## Proposed Auth-Owned Schema

Add a TypeORM entity such as `src/users/entities/legacy-identity-mapping.entity.ts`:

- `id`: UUID primary key.
- `legacySystem`: string, indexed; value for this migration: `speakasap-portal`.
- `legacyUserId`: integer.
- `authUserId`: UUID foreign key to `users.id`.
- `normalizedEmail`: nullable string.
- `status`: enum/string, for example `mapped`, `created`, `skipped_duplicate_email`, `skipped_blank_email`, `skipped_conflict`, `skipped_unusable`.
- `reason`: nullable text.
- `sourceSnapshot`: nullable JSONB with non-secret source fields needed for audit, excluding password hashes.
- `createdAt`, `updatedAt`.

Constraints:

- Unique `(legacySystem, legacyUserId)`.
- Index `authUserId`.
- Index `(legacySystem, normalizedEmail)`.
- Foreign key from `authUserId` to `users.id` with restrictive delete behavior.

Register the entity in `shared/database/database.module.ts` only after owner approval.

## Proposed Bootstrap Script

Add an auth-owned script such as `scripts/bootstrap-speakasap-legacy-users.ts` plus shell wrapper if needed.

Required modes:

- `--dry-run`: required by default for first implementation; no writes.
- `--json-report <path>`: writes machine-readable report.
- `--limit <n>`: limits sample arrays only, not counts.
- `--apply`: refused unless owner approval is recorded in the status doc and an explicit confirmation flag is supplied.
- `--password-policy reset-only`: first approved policy; creates or maps users with `password = NULL`.

Inputs:

- Legacy source DB URL from a dedicated environment variable such as `SPEAKASAP_LEGACY_DATABASE_URL`.
- Auth target DB via existing auth `.env` variables or TypeORM app context.

Dry-run report must include:

- legacy totals: users, active users, staff users, superusers, last-login users;
- email quality: blank emails, duplicate email groups, rows in duplicate groups, max group size;
- password families: bcrypt, Django PBKDF2, Django unusable, empty, other;
- target auth totals: users, users with email, users with password, duplicate target email groups;
- mapping decisions: existing target email matches, create candidates, duplicate-email candidates, skipped candidates, conflicts;
- samples for each bucket without printing password hashes or secrets;
- planned write counts for `users` and `legacy_identity_mappings`;
- explicit `writes=false`.

Apply mode, after owner approval only:

- must run in a database transaction;
- must never copy legacy password hashes into `users.password` under the reset-only policy;
- should preserve existing auth users when normalized email already exists;
- should create new auth users for unambiguous emails with `password = NULL`, `source = 'speakasap-portal'`, `isActive` from legacy, and reasonable name/phone fields from legacy;
- should create mapping rows for every imported/mapped legacy user;
- should produce a post-write reconciliation report.

## Duplicate Email Policy

Recommended implementation for duplicates:

- create one auth user per approved canonical email only if the owner chooses merge/canonical import;
- otherwise create mapping rows with skipped status for duplicate groups until owner reviews them;
- do not silently choose among duplicate active student-referenced users.

Because duplicate groups currently include `192` student user references and `2` teacher user references, the first dry-run should treat duplicate rows as a separate unresolved bucket unless the owner approves merge rules.

## Verification Sequence

Before code changes:

1. Owner approves password policy, duplicate-email policy, and auth-microservice implementation boundary.
2. Confirm `auth-microservice` branch and working tree.

After dry-run implementation:

1. `npm run build` in `/home/ssf/Documents/Github/auth-microservice`.
2. Run the bootstrap script with `--dry-run --json-report /tmp/speakasap-auth-bootstrap-dry-run.json`.
3. Verify the JSON report says `writes=false`.
4. Re-run `user-service/scripts/migrate-user-from-legacy.py --dry-run --check-target --json-report /tmp/speakasap-user-dry-run-after-auth-bootstrap.json`.
5. Confirm unresolved auth counts match the approved duplicate/skip policy.

Before apply mode:

1. Owner confirms the dry-run report.
2. Capture auth DB backup or rollback plan.
3. Run apply only through the approved auth-owned script.

## Rollback

Rollback must be auth-owned:

- delete only rows created by the bootstrap script, identifiable by `legacy_identity_mappings.legacySystem = 'speakasap-portal'` and `users.source = 'speakasap-portal'`;
- preserve pre-existing target auth users and only remove mapping rows pointing at them if rollback is approved;
- record before/after counts.

## Next Implementation Chunk

After owner approval, create the auth-microservice branch and implement only the dry-run script and mapping entity/schema first. Apply mode should remain disabled until dry-run evidence is reviewed.
