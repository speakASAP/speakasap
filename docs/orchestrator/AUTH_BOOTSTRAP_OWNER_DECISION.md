# Auth Bootstrap Owner Decision

Status: pending owner approval for Goal 4.9.

## Decision Needed

Before any user-service write migration, the owner must approve how legacy SpeakASAP identities become target `auth-microservice` identities.

This decision is required because:

- `auth-microservice` owns identity and JWTs.
- `auth-microservice/BUSINESS.md` forbids AI agents from directly writing the auth user table.
- Target auth currently has only `22` users, while legacy `auth_user` has `214230` users.
- User-service profile rows require target auth UUIDs.

## Recommended Policy

Approve an auth-owned bootstrap path with:

- a dedicated auth-owned legacy mapping table, for example `legacy_identity_mappings`, preserving `legacy_system`, `legacy_user_id`, `auth_user_id`, normalized email, import status, and reason;
- target auth users created with `password = NULL`;
- users required to set credentials through password reset or magic-link setup;
- duplicate legacy emails represented in the mapping table instead of forcing all legacy rows into the unique `users.email` column;
- a read-only dry-run report before any auth write path;
- owner approval required again before the first auth write execution.

This keeps identity ownership in `auth-microservice`, avoids unsupported Django PBKDF2 password import, and gives `user-service` a deterministic `legacy auth_user.id -> target users.id` mapping.

## Alternatives

Option A: password reset / magic-link setup with `password = NULL`.

- Pros: preserves bcrypt-only auth rule; fastest low-risk path; no legacy password verifier in auth login.
- Cons: users must re-establish passwords or use magic links.

Option B: Django PBKDF2 compatibility in `auth-microservice`, then rehash to bcrypt after successful login.

- Pros: preserves password continuity for many users.
- Cons: changes the central auth security path; must be implemented and tested in `auth-microservice`; requires owner security approval.

Option C: copy legacy password hashes into auth `users.password`.

- Rejected unless the owner explicitly overrides the current policy. Current auth code rejects non-bcrypt hashes, so copied Django hashes would not allow password login.

## Duplicate Email Evidence

Read-only aggregate evidence from legacy `auth_user`:

- Duplicate lower-trimmed email groups: `95`
- Rows in duplicate groups: `192`
- Largest duplicate group: `3`
- Active rows in duplicate groups: `190`
- Staff rows in duplicate groups: `0`
- Superuser rows in duplicate groups: `0`
- Student user references in duplicate groups: `192`
- Teacher user references in duplicate groups: `2`
- Manager user references in duplicate groups: `0`
- Employee profile user references in duplicate groups: `0`

Conclusion: duplicate emails are not only stale accounts. They include active student-referenced rows, so the bootstrap needs explicit mapping/reporting instead of silently skipping duplicates.

## Approval Questions

1. Password policy: approve `password = NULL` plus password reset/magic-link setup, or require Django PBKDF2 compatibility?
2. Duplicate-email policy: approve dedicated auth-owned mapping table, merge duplicate accounts, or import one canonical account and skip the rest?
3. Implementation boundary: approve adding the dry-run/bootstrap script and mapping schema inside `/home/ssf/Documents/Github/auth-microservice`?

## Gate

Until these answers are recorded:

- no auth write migration may run;
- no user-service profile write migration may run;
- education/course dry-run evidence remains usable, but lesson-record writes still wait for ordered education/user/auth reconciliation.
