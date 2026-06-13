# Goal 8 Controlled Cutover - Lesson Recording Workflow

Date: 2026-06-13

Status: controlled cutover validation complete for the migrated lesson-recording route. Legacy freeze/decommission is **not executed** and remains a separate reversible decision.

## Approval

Owner approval was recorded in the Codex thread on 2026-06-13:

```text
You have my approval. Continue.
```

The approved action was interpreted as controlled cutover validation for the already-routed migrated lesson-recording workflow on `https://speakasap.alfares.cz`, using the Goal 7 readiness checklist and rollback plan.

No additional approval was inferred for destructive operations, object deletion, migration reruns, legacy shutdown, DNS change, or irreversible decommission.

## Cutover Action

No traffic switch was required during this pass because the public ingress already routes:

- `/` to `speakasap-frontend:4211`
- `/api` to `speakasap-api-gateway:4210`
- `/health` to `speakasap-api-gateway:4210`

The controlled cutover action was therefore:

1. Keep the migrated lesson-recording frontend and gateway route live.
2. Re-run post-approval public smoke checks.
3. Re-run authenticated workflow smoke with fresh short-lived JWTs generated inside the auth runtime.
4. Monitor affected deployment rollout, pod restart, event, and last-hour log evidence.
5. Keep rollback path available.

## Evidence Files

- Cutover smoke report: `/tmp/speakasap-goal8-cutover-smoke.json`
- Cutover monitoring report: `/tmp/speakasap-goal8-cutover-monitoring.json`
- Readiness report: `/tmp/speakasap-goal7-operational-readiness.json`
- Authorized frontend parity report: `/tmp/speakasap-goal63-frontend-parity-browser-report.json`
- Readiness runbook: `docs/orchestrator/GOAL_7_CUTOVER_READINESS.md`

All reports omit JWT values and signed media URLs.

## Public Smoke

| Check | Observed |
| --- | --- |
| `https://speakasap.alfares.cz/` | `200 text/html; charset=utf-8` |
| `https://speakasap.alfares.cz/health` | `200 application/json; charset=utf-8` |
| learner lesson-recording route | `200 text/html; charset=utf-8` |
| teacher lesson-recording route | `200 text/html; charset=utf-8` |

## Workflow Smoke

Fresh short-lived JWTs were generated inside the `auth-microservice` pod. Token values were not printed.

| Check | Expected | Observed |
| --- | --- | --- |
| no-auth state request | `401` | `401` |
| paid learner state | `200` | `200` |
| paid learner playback metadata | `200` | `200` |
| paid learner tokenized range download | `206` | `206` |
| unpaid learner playback denial | `403` | `403` |
| assigned teacher presign | `201` | `201` |
| unassigned teacher presign denial | `403` | `403` |
| staff presign | `201` | `201` |
| delete without confirmation | `400` | `400` |

No checked response exposed a permanent public recording URL.

## Monitoring

Affected deployments remained rolled out:

- `speakasap-frontend`
- `speakasap-api-gateway`
- `speakasap-education`

Current affected pods remained `1/1 Running` with `0` restarts.

Last-hour log scan for `warning`, `warn`, `error`, `exception`, and `fatal`:

- `speakasap-frontend`: `0`
- `speakasap-api-gateway`: `0`
- `speakasap-education`: `0`

SpeakASAP-specific events still show normal frontend rollout history and the known transient readiness failure on an old frontend pod during replacement. Current pods are ready.

## Rollback Availability

Rollback remains available through the non-destructive commands recorded in `docs/orchestrator/GOAL_7_CUTOVER_READINESS.md`:

```bash
kubectl rollout undo deployment/speakasap-frontend -n statex-apps
kubectl rollout undo deployment/speakasap-api-gateway -n statex-apps
kubectl rollout undo deployment/speakasap-education -n statex-apps
```

If rollback is needed after user interaction, execute it only with owner approval and record the exact reason, timestamp, and post-rollback smoke evidence.

## Legacy Freeze / Decommission

Legacy shutdown or freeze was not performed in this pass.

Reason:

- The approval did not name a specific legacy route, DNS target, nginx rule, feature flag, or repository path to freeze.
- The current safe state is to keep the legacy portal available as rollback/reference until a reversible legacy-freeze target is explicitly selected.

Next legacy-freeze decision must identify:

- exact legacy route or traffic source;
- reversible freeze mechanism;
- owner-approved rollback window;
- monitoring commands;
- user-facing communication requirement, if any.

## Gate Decision

Controlled cutover validation for the migrated lesson-recording workflow is complete and clean.

Goal 8 remains active for a separate owner-selected legacy freeze/decommission target. No irreversible decommission has been executed.
