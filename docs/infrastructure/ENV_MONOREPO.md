# SpeakASAP Environment Variables

## Production (Kubernetes)

Secrets live in **Vault** at `secret/prod/speakasap`. ESO syncs them to K8s Secret `speakasap-secret` every 5 min.
Pods receive env vars via `envFrom: secretRef` + `configMapRef` (see `k8s/configmap.yaml`).
Never edit `.env` in production — update Vault: `vault kv patch secret/prod/speakasap KEY=value`.

## Local Development

```bash
# Generate .env from Vault (one-time or when secrets change)
./shared/scripts/vault-env-gen.sh speakasap prod
```

The generated `.env` lives at repo root (`speakasap/.env`). All services use `env_file: ../.env` in their local `docker-compose.yml`.

## Per-service DATABASE_URL aliases

Each service reads its own DB URL from a prefixed variable so multiple services can coexist:

| Service | Env var |
|---------|---------|
| certification | `CERTIFICATION_DATABASE_URL` |
| assessment | `ASSESSMENT_DATABASE_URL` |
| user | `USER_DATABASE_URL` |
| course | `COURSE_DATABASE_URL` |
| education | `EDUCATION_DATABASE_URL` |
| salary | `SALARY_DATABASE_URL` |
| financial | `FINANCIAL_DATABASE_URL` |
| content | `DATABASE_URL` |

## Prisma CLI (local)

Run from service directory — reads `../.env`:
```bash
npm run prisma:validate        # validate schema
npm run prisma:migrate:deploy  # apply migrations
```

## Legacy portal DB tunnel (ETL only)

```bash
```

Use `CERTIFICATION_SOURCE_DATABASE_URL=postgresql://...@db-server-postgres.statex-apps.svc.cluster.local:5432/...` for ETL scripts.
