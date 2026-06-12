# Auth Identity Reconciliation

Status: decision gate for Goal 4.8.

## Intent

User-service profile migration requires target auth UUIDs, but `auth-microservice` remains the identity owner. SpeakASAP services may mirror auth UUIDs; they must not invent identities or write directly to the auth user table.

## Evidence

Legacy source `auth_user`:

- Rows: `214230`
- Rows with email: `214230`
- Rows with password: `214230`
- Duplicate lower-trimmed email groups: `95`
- Password hash families:
  - `django_pbkdf2_sha256`: `212415`
  - `django_unusable_password`: `1815`

Target auth database `users`:

- Rows: `22`
- Rows with email: `22`
- Rows with password: `17`
- Duplicate lower-trimmed email groups: `0`
- Columns include UUID `id`, nullable unique `email`, nullable `password`, names, phone, `source`, status flags, and preference columns.

Code constraints:

- `auth-microservice/BUSINESS.md` says password hashing is bcrypt only and AI agents must not directly write the user table.
- `auth-microservice/src/auth/auth.service.ts` rejects password login unless the stored password matches bcrypt hash format.
- `auth-microservice` has RBAC seed/admin scripts, but no existing SpeakASAP legacy auth import script.
- `user-service/scripts/migrate-user-from-legacy.py` currently resolves identities by lower-trimmed email from target auth `users`; the DB-backed dry run indexed only `22` target auth emails and left `214224` legacy `auth_user` rows unresolved.

## Decision

The target auth database must be bootstrapped before user-service profile migration. Email matching alone is not a safe identity strategy because the legacy source has duplicate email groups and the target auth service uses email uniqueness.

The migration contract should be:

- `auth-microservice` creates or maps target UUIDs for legacy users.
- The mapping must preserve `legacy auth_user.id -> target users.id`.
- `user-service` consumes that mapping and writes `user_identity_mirror.legacy_portal_user_id` plus profile rows.
- Any skipped, merged, or duplicate-email legacy users must be explicit in a dry-run report before writes.

## Password Policy Options

Recommended for first cutover: bootstrap auth users with `password = NULL` and force password reset or magic-link setup. This obeys the current bcrypt-only rule and avoids importing unsupported Django PBKDF2 hashes.

Alternative requiring owner approval and auth-service code change: add a Django PBKDF2 verifier with rehash-to-bcrypt on successful login. This preserves legacy password continuity but changes a core auth security path and must be implemented inside `auth-microservice`, not SpeakASAP.

Rejected without owner approval: copying legacy Django password hashes into `auth.users.password`. Current auth login will reject them because it checks bcrypt format.

## Duplicate Email Policy Required

The `users.email` column is unique, while legacy has `95` duplicate email groups. Before any auth bootstrap write, the owner must approve one policy:

- merge duplicate legacy accounts into one auth identity and record all linked legacy IDs;
- import one canonical account and skip the rest with an owner-reviewed report;
- introduce a dedicated legacy identity mapping table in `auth-microservice` so duplicate email records can be represented without violating unique email constraints.

The safest technical direction is a dedicated auth-owned legacy mapping table or column because it keeps identity ownership in `auth-microservice` and gives `user-service` a deterministic UUID mapping.

## Acceptance Gate

No user-service write migration may run until:

- an auth-owned bootstrap or mapping path exists;
- a dry-run report shows total legacy users, duplicate email groups, imported/mapped users, skipped users, and password policy;
- owner approval records the duplicate-email and password policy;
- `user-service/scripts/migrate-user-from-legacy.py --dry-run --check-target` shows unresolved auth counts are within the approved skip policy.
