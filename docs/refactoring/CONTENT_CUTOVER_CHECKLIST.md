# Content Service Cutover Checklist

Date: 2026-04-10  
Owner: Phase 1 validation/cutover team

## Pre-Cutover (Must Pass)

- [x] Resolve known production blocker first: translation endpoints return 404 on alfares runtime (`POST /api/v1/dictionary/translate`, `POST /api/v1/grammar/translate`). **RESOLVED 2026-04-10** — stale container rebuilt and redeployed; routes confirmed live (400 on invalid payload, 200/504 on valid payload depending on AI service availability).
- [ ] Confirm `docs/refactoring/PHASE1_VALIDATION_REPORT.md` is updated to GO state.
- [ ] Verify latest content migration parity (all 10 entities) and archive counts.
- [ ] Run endpoint smoke matrix against target environment:
  - [ ] `GET /health`
  - [ ] `GET /api/v1/languages`
  - [ ] `GET /api/v1/languages/:code`
  - [ ] `GET /api/v1/grammar`, `/grammar/courses`, `/grammar/:id`
  - [ ] `GET /api/v1/phonetics`, `/phonetics/courses`, `/phonetics/:id`
  - [ ] `GET /api/v1/songs`, `/songs/courses`, `/songs/:id`
  - [ ] `GET /api/v1/dictionary`, `/dictionary/themes`, `/dictionary/themes/:id`, `/dictionary/:id`
- [ ] Run negative-path checks:
  - [ ] invalid IDs -> 400
  - [ ] missing entities -> 404
  - [ ] verify standard error body shape
- [ ] Run AI probes:
  - [ ] translation success (`dictionary/translate`, `grammar/translate`)
  - [ ] timeout/unavailable behavior and returned status codes
  - [ ] verify error logging with timestamp and `duration_ms`
- [ ] Validate configuration:
  - [ ] `MAX_PAGE_SIZE <= 30`
  - [ ] required env keys present
  - [ ] no hardcoded service hosts in code
- [ ] Capture baseline metrics:
  - [ ] API p95 latency for key list endpoints
  - [ ] DB query timing from logs
  - [ ] AI call latency distribution
- [ ] Confirm rollback tooling and access are ready.

## Cutover Execution

- [ ] Freeze legacy content writes (or explicitly accept delta sync policy).
- [ ] Execute final migration sync (if needed) and validate counts.
- [ ] Deploy content-service release using existing service deploy script.
- [ ] Switch traffic to new content-service route.
- [ ] Run immediate post-switch smoke checks:
  - [ ] health
  - [ ] languages list
  - [ ] one endpoint from each content domain
- [ ] Verify centralized logging receives request + error streams.

## Post-Cutover Monitoring (First 60 Minutes)

- [ ] Monitor error rate and 5xx spikes.
- [ ] Monitor response latency for list endpoints.
- [ ] Monitor AI translation error/timeout rate.
- [ ] Spot-check data correctness in API responses (languages, grammar, dictionary).
- [ ] Confirm no regression in dependent consumers.

## Rollback Procedure

- [ ] Trigger rollback if any critical condition is hit:
  - sustained 5xx above threshold
  - broken core endpoints
  - data mismatch affecting users
- [ ] Repoint traffic to previous stable target.
- [ ] Restore prior deployment artifact/environment.
- [ ] If rollback is data-related, restore target DB state using documented rollback process.
- [ ] Publish incident note with root cause and recovery plan.

## Success Criteria

- [ ] All core endpoints return expected contract shape.
- [ ] Error handling conforms to standardized error format.
- [ ] Data parity confirmed after final sync.
- [ ] AI translation endpoints work with correct failure behavior.
- [ ] No critical alerts during first 60 minutes post-cutover.

## Verification Artifacts to Attach

- [ ] Curl/output log for endpoint matrix.
- [ ] Migration count comparison snapshot.
- [ ] AI success/failure probe outputs.
- [ ] Logging/latency excerpts with timestamps.
- [ ] Final GO approval record.

## Runtime Bootstrapping (if blocked)

- [ ] Verify currently deployed route config and app version expose translate endpoints before any timeout/config tuning.
- [ ] Confirm runtime health and container state (`docker ps`, `/health`).
- [ ] Re-run this checklist from "endpoint smoke matrix".
