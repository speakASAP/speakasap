# Goal 5 Lesson Recording Runtime Context Package

Date: 2026-06-13

## Scope

Owner approved the Goal 5 follow-up scope after deployed playback smoke passed. This package covers target education-service merge/delete implementation, gateway streaming parity for recording downloads, and frontend gateway-only controls for recording runtime checks.

## Upstream Traceability

- `docs/orchestrator/LESSON_RECORDING_CONTRACT.md` defines private recording access, merge, delete, gateway, and frontend rules.
- `docs/orchestrator/LESSON_RECORDING_INVENTORY.md` records legacy portal behavior from `speakasap-portal`.
- Legacy reference: `/home/ssf/Documents/Github/speakasap-portal/education/tasks.py` `merge_records`, `cabinet/teacher/forms.py`, and `education/api/teacher/views/records.py`.
- Current target implementation: `education-service/src/lesson-records/*`, `api-gateway/src/proxy/*`, `frontend/app/{teacher,learner}/page.tsx`.

## Invariants

- Recordings remain private; no public or permanent object URLs.
- Students need paid lesson access for playback; teachers need assignment; staff can administer.
- Source part objects may be deleted only after merged output validation and DB commit.
- Delete is owner-approved for this chunk, but must be explicit and auditable through returned counts and scoped lesson authorization.
- Gateway must not expose MinIO directly and must forward bearer/range headers.

## Sensitive Data Classification

Lesson recordings and object keys are private education data. API responses may expose only route-scoped playback/download URLs and key state markers, not storage secrets. Logs and reports must not print JWTs, S3 secret keys, presigned upload URLs, or raw private media content.

## DocsRAG

DocsRAG will be queried with the runtime `JWT_TOKEN` before or during implementation. If unavailable, status will record the limitation and source docs above remain authoritative.
