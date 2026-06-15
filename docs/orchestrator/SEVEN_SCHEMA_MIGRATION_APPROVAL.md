# Seven Schema Migration Approval Packet - Superseded

Status: superseded by `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

Do not use this file as an active approval packet. Target DB evidence later proved that the Kubernetes-backed `speakasap_content_db` has no base content schema, so the active schema approval must cover content-service base schema readiness plus seven schema creation through the normal content-service Prisma migration history.

The active approval packet is:

- `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`

Still out of scope unless separately approved:

- seven data apply;
- media download/copy/object mutation;
- image build/push or Kubernetes deployment;
- public route cutover;
- legacy `speakasap-portal` route retirement;
- destructive rollback or cleanup.

Required active approval wording is maintained only in `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.
