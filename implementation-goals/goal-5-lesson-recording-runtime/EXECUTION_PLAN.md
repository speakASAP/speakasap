# Goal 5 Lesson Recording Runtime Execution Plan

1. Query DocsRAG for SpeakASAP lesson recording merge/delete/frontend/gateway context.
2. Update education storage adapter with private object get/put/delete helpers using existing SigV4 signing and key fallback rules.
3. Implement `POST /api/v1/lessons/:lessonUuid/record/merge` as authorized, idempotent, deterministic part merge with output validation before part cleanup.
4. Implement `DELETE /api/v1/lessons/:lessonUuid/record` as authorized metadata cleanup plus best-effort object deletion after selecting lesson-owned keys.
5. Update runtime contract verifier away from stub expectations.
6. Update gateway proxy to stream upstream responses and preserve range headers for media downloads.
7. Add minimal teacher/learner frontend controls that call gateway recording endpoints only.
8. Run education build/test, gateway build if changed, frontend build if changed.
9. Deploy changed services through existing Kubernetes/Docker workflow.
10. Run sanitized runtime smoke checks, including merge/delete behavior on controlled data only, and update orchestrator docs.
