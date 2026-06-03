# Agents: speakasap


## Knowledge Retrieval (query before reading files)
Query the RAG service first to reuse indexed ecosystem context before reading raw files:

```bash
curl -s -X POST http://docs-rag-microservice.statex-apps.svc.cluster.local:3397/retrieval/agent-context \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR QUESTION HERE", "maxTokens": 3000}'
```

- Internal URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Public URL: `https://docs-rag.alfares.cz`
- Full guide: `docs-rag-microservice/docs/RAG_USAGE.md`

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
