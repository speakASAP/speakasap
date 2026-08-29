# Salary Education Deploy Approval

Date: 2026-06-15

Status: owner approved proceeding in chat: "I approve. Go ahead with planning".

## Scope

Approved only for Goal 9.6 salary readiness planning gate:

- Build and push `localhost:5000/speakasap-education:latest` from `education-service/Dockerfile`.
- Apply only `k8s/services/education-service.yaml` if needed for the education deployment/config/secret wiring.
- Restart and wait only for `deployment/speakasap-education` in namespace `statex-apps`.
- Run read-only post-deploy health and no-write salary readiness/calculation preview checks for period `2026-05`.

## Explicitly Not Approved

- Root `scripts/deploy.sh` all-service rollout.
- Salary calculation enablement for broad use.
- Payout creation, payout commit, or payment-service disbursement.
- Rollback execution.
- Salary expense/profile mutation.
- Education data mutation beyond deploying already verified runtime code.
- Legacy route retirement, destructive cleanup, object-storage mutation, or user-facing payment behavior changes.

## Rollback Plan

If the education rollout fails or health checks fail, inspect the current deployment snapshot and run only the scoped Kubernetes undo/status path for `speakasap-education`:

```bash
/home/ssf/Documents/Github/shared/scripts/with-deploy-lock.sh bash -lc \
  'kubectl rollout undo deployment/speakasap-education -n statex-apps && /home/ssf/Documents/Github/shared/scripts/wait-for-rollout.sh -n statex-apps -t 180 speakasap-education'
```

Rollback execution still requires recording the failure and rollback evidence in `docs/orchestrator/STATUS.md`.
