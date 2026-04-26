# Phase 5 Gateway Cutover Checklist (TASK-68)

**Date:** 2026-04-25  
**Wave:** Phase 5 - Wave 1 (`speakasap-api-gateway`)  
**Status:** Engineering gates closed; operational follow-up tracked.

## Preconditions

- [x] `P5-GA` PASS
- [x] `P5-GB` PASS
- [x] `P5-GC` PASS
- [x] `P5-GD` PASS (engineering)
- [ ] Operator confirms maintenance window / rollout slot (if required)

## Deploy steps (gateway)

- [ ] Ensure root `speakasap/.env` has gateway and upstream URL keys populated.
- [ ] Confirm `speakasap/.env.example` contains non-secret gateway key names only.
- [ ] Build gateway: `cd api-gateway && npm run build`.
- [ ] Deploy gateway container using standard service deploy flow (no nginx manual edits).
- [ ] Confirm gateway `/health` returns `200`.

## Post-deploy smoke

- [ ] Public route without bearer -> `401`.
- [ ] Public attempt to `/api/v1/internal/**` without internal token -> `403`.
- [ ] Rate-limit threshold hit -> `429`.
- [ ] Invalid `limit` (>30 / <1 / non-numeric) -> `400 INVALID_LIMIT`.
- [ ] Upstream-down scenario maps to `502`.
- [ ] Upstream-timeout scenario maps to `504`.
- [ ] Representative routes per service family return expected statuses.

## Logging and diagnostics

- [ ] Verify gateway logs include ISO timestamp and `duration_ms`.
- [ ] Verify request correlation id is present in request lifecycle logs.
- [ ] Verify no raw JWT or internal token values appear in logs.
- [ ] For any timeout, inspect logs for blocking upstream call before any timeout tuning.

## Rollback

- [ ] Keep previous stable gateway image/tag available.
- [ ] If critical gateway regression appears, roll back gateway service image/tag.
- [ ] Re-run `/health`, auth boundary checks (`401/403`), and one representative proxied route.
- [ ] Document rollback trigger, timestamp, and outcome in incident notes.

## Deferred items

| ID | Item | Owner | Required to close |
| --- | --- | --- | --- |
| P5-GW-01 | Live cross-service HTTP smoke matrix with all upstream containers online | Operator | Attach captured request/response evidence and mark row PASS or WAIVE with rationale |

## Closure

- [ ] All required deploy and smoke rows complete.
- [ ] Deferred items closed or explicitly waived with owner sign-off.
- [ ] Mark `P5-GE` final status in orchestration tracker.
