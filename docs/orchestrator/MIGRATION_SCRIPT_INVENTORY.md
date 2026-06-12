# Migration Script Inventory

Date: 2026-06-12

Goal chunk: 4.3 - Remaining migration script inventory.

Purpose: record the current state of service-owned Prisma schemas and legacy-to-service migration scripts before adding more write-mode migration behavior.

## Inventory Summary

| Service | Prisma schema | Migration scripts | Domain | Current dry-run quality | Write safety / idempotency | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| assessment-service | `assessment-service/prisma/schema.prisma` | `assessment-service/scripts/migrate-assessment-from-legacy.py` | Language tests, questions, answers, user test attempts/results | Counts-only dry run. Does not emit source-to-target ID maps or conflict IDs. | Uses `ON CONFLICT` upserts for most writes, but exposes `--truncate-first`. Needs owner approval gate before destructive use. | Medium |
| certification-service | `certification-service/prisma/schema.prisma` | `certification-service/scripts/migrate-certification-from-legacy.py` | Course certificates, education certificates, quests/questionnaires | Counts-only dry run. Does not emit detailed orphan/conflict report. | Uses upsert-style writes in places, but exposes `--truncate-first`. Needs stronger reconciliation before load. | Medium |
| content-service | `content-service/prisma/schema.prisma` | No service migration script found | Grammar, phonetics, songs, words, word themes | No script-level dry run exists. | No load script found, so target ownership exists but migration path is undefined. | Medium |
| course-service | `course-service/prisma/schema.prisma` | `course-service/scripts/migrate-course-from-legacy.py` | Product categories, products, offers, part payment settings | Counts-only dry run. | Plain inserts in copy helpers and `--truncate-first`; not safely rerunnable unless target is empty or truncated. Needs hardening before write use. | High |
| education-service | `education-service/prisma/schema.prisma` | `education-service/scripts/migrate-course-from-legacy.py`, `education-service/scripts/migrate-education-from-legacy.py`, `education-service/scripts/migrate-lesson-records-from-legacy.py` | Groups, student courses, lessons, homework, lesson recordings | Existing education/course scripts are counts-only. Lesson-record script is dry-run-only and reports counts plus exact conflict IDs. | Existing education/course scripts use plain inserts and `--truncate-first`; lesson-record script has no write mode. Education is high priority because lesson recording depends on target lesson parity. | High |
| financial-service | `financial-service/prisma/schema.prisma` | `financial-service/scripts/migrate-financial-data.ts` | Category axis snapshots, monthly revenue rollups, ledger lines, financial sync state | Transform/count dry run with JSON logs and optional docs output. | Requires explicit `--load`; uses Prisma upserts on unique keys. Safer than older Python scripts. Still needs reconciliation totals before cutover approval. | Low |
| notification-service | `notification-service/prisma/schema.prisma` | `notification-service/scripts/migrate-notification-data.ts`, `notification-service/scripts/migrate-notification-data.js` | Templates, groups, group managers, common email settings, preferences, in-app notifications, letters | Dry run collects legacy counts, missing template files, orphan template counts, and transform summaries. | Requires explicit `--load`; uses upserts/createMany skipDuplicates. Replaces template-group and manager links with scoped `deleteMany` for migrated IDs, so owner approval and post-load verification are required. Treat `.ts` as source and `.js` as generated/runtime copy unless the build process says otherwise. | Medium |
| payment-service | `payment-service/prisma/schema.prisma` | `payment-service/scripts/migrate-payment-data.ts`, `payment-service/scripts/migrate-payment-data.js` | Orders, payment attempts, discounts, invoices, webhook/idempotency tables | Dry run logs legacy counts, transform summary, optional spot-check, docs output, and post-load verify mode. | Requires explicit `--load`; uses deterministic UUIDs and createMany skipDuplicates. It preserves legacy IDs in payloads but does not update existing rows. High business risk because payments need owner signoff before load. | High |
| salary-service | `salary-service/prisma/schema.prisma` | `salary-service/scripts/migrate-salary-data.ts` | Salary profiles, salary expenses, employee contracts, payout/calculation support tables | Dry run logs legacy counts, table flags, period summaries, transform summary, and optional docs output. | Requires explicit `--load`; uses deterministic UUIDs and createMany skipDuplicates. Lesson salary rows keep `lessonUuid` null until education backfill. Needs education mapping before final salary reconciliation. | Medium |
| user-service | `user-service/prisma/schema.prisma` | `user-service/scripts/migrate-user-from-legacy.py` | User identity mirror, students, teachers, managers, employee profiles, teacher languages | Dry run reports source counts and auth-index size/unresolved auth status, but does not produce full source-to-target map. | Uses `ON CONFLICT` upserts for most writes and clears teacher additional language links during write. Exposes `--truncate-first`; needs owner approval gate and better conflict report. | High |

## Service Model Coverage

Current Prisma model coverage by service:

- `assessment-service`: language test catalog, language questions/answers, user test attempts, user test answers/results, asset user tests.
- `certification-service`: course certificates, education certificates, quest instances, questionnaires, user questionnaire answers.
- `content-service`: languages, grammar courses/lessons, phonetics courses/lessons, songs courses/lessons, words, word themes.
- `course-service`: product categories, products, part payment options, extra lesson offers, offers.
- `education-service`: groups, group students, student courses, lessons, homework. No lesson-record tables exist yet.
- `financial-service`: category snapshots, monthly category/method revenue, ledger lines, operating expenses, salary total cache, financial rollups, sync state.
- `notification-service`: templates, groups, template/group links, letters, common email settings, preferences, in-app notifications, dispatch idempotency.
- `payment-service`: orders, payment attempts, discount templates/products/orders, subscriptions, invoices, webhook events, idempotency records.
- `salary-service`: salary profiles, salary expenses, employee contracts, calculation runs/lines, payout runs/lines, idempotency records.
- `user-service`: identity mirror, students, teachers, teacher additional languages, managers, employee profiles.

## Safety Findings

High-risk scripts:

- `course-service/scripts/migrate-course-from-legacy.py`: plain inserts plus `--truncate-first`; needs idempotent upserts or target-conflict reporting before write use.
- `education-service/scripts/migrate-education-from-legacy.py`: plain inserts plus `--truncate-first`; blocks lesson recording because target lessons must be reliable before record metadata can be loaded.
- `education-service/scripts/migrate-course-from-legacy.py`: appears to duplicate course migration behavior under the education service folder; ownership must be clarified before further use.
- `payment-service/scripts/migrate-payment-data.ts`: technically safer, but payment data is high business risk and needs explicit owner approval plus reconciliation.
- `user-service/scripts/migrate-user-from-legacy.py`: mostly upserted, but auth resolution gaps must be explicit before relying on migrated role data.

Safer existing patterns to reuse:

- Require explicit `--load`; default to no writes.
- Emit JSON logs and append optional docs/refactoring run logs.
- Use deterministic IDs from legacy IDs.
- Use `upsert` or `createMany(..., skipDuplicates: true)` where replacement semantics are acceptable.
- Provide post-load verification mode for high-risk services.

Patterns to avoid or gate:

- `--truncate-first` without recorded owner approval.
- Counts-only dry runs for service cutover decisions.
- Plain inserts where rerun is expected.
- Scoped `deleteMany` without a preflight list of affected IDs.
- Generated `.js` migration copies drifting from `.ts` source.

## Recommended Next Migration Target

Continue Goal 4 with source-to-target mapping for the domains that block the selected lesson-recording workflow:

1. `education-service/scripts/migrate-education-from-legacy.py`
2. `user-service/scripts/migrate-user-from-legacy.py`
3. `course-service/scripts/migrate-course-from-legacy.py`

Reason:

- Lesson records reference lessons and, through access checks, students/teachers.
- The current lesson-record script can report missing target lessons, but it cannot prove parity until education and user mappings are explicit.
- Payment, salary, notification, assessment, certification, financial, and content migrations can remain inventoried until the lesson-recording dependency chain is hardened.

## Acceptance Evidence For Goal 4.3

- Migration scripts found across `assessment-service`, `certification-service`, `course-service`, `education-service`, `financial-service`, `notification-service`, `payment-service`, `salary-service`, and `user-service`.
- Prisma schemas found across `assessment-service`, `certification-service`, `content-service`, `course-service`, `education-service`, `financial-service`, `notification-service`, `payment-service`, `salary-service`, and `user-service`.
- `content-service` has Prisma schema coverage but no migration script found in this inventory.
- `notification-service` and `payment-service` each have both `.ts` and `.js` migration files.
- Next chunk should define source-to-target mapping for the remaining domains, starting with the education/user/course dependency chain for lesson recordings.
