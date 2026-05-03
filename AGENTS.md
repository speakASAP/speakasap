# Agents: speakasap

## Repositories

| Repo | Role |
|------|------|
| **speakasap** (this repo) | NestJS microservices monorepo — all 12 speakasap services |
| **speakasap-portal** | Legacy Django 1.11 at speakasap.com — read-only reference; migration complete |

## Deployment

All services run on Kubernetes (`statex-apps` namespace). Manifests in `speakasap/k8s/`.
Secrets: Vault → ESO → K8s Secrets. See `../shared/docs/VAULT.md`.
Deploy: `kubectl rollout restart deployment/<svc> -n statex-apps` or rebuild image + apply manifests.

## Coordinator Config

```yaml
model_tier: cheap
cycle_interval_minutes: 120
max_tasks_per_cycle: 8
```

## Active Agents
<!-- Coordinator-maintained -->
None.
