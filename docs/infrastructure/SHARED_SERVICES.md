# Shared Services Integration

Standard env keys for shared microservices. In K8s these come from `speakasap-secret` (Vault → ESO). In local dev, generate `.env` via `vault-env-gen.sh speakasap prod`.

| Service | Env key | Default |
|---------|---------|---------|
| Auth | `AUTH_SERVICE_URL` | `http://192.168.88.53:3370` |
| PostgreSQL | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | `db-server-postgres.statex-apps.svc.cluster.local:5432` |
| Redis | `REDIS_HOST`, `REDIS_PORT` | `db-server-redis.statex-apps.svc.cluster.local:6379` |
| Logging | `LOGGING_SERVICE_URL`, `LOGGING_SERVICE_API_PATH` | `http://192.168.88.53:3367`, `/api/logs` |
| Notifications | `NOTIFICATION_SERVICE_URL` | `http://192.168.88.53:3368` |
| Payments | `PAYMENTS_MICROSERVICE_URL` | `http://192.168.88.53:3468` |
| AI | `AI_SERVICE_URL` | `http://192.168.88.53:3380` |

## Integration notes

- **Auth**: POST `{AUTH_SERVICE_URL}/auth/validate` with Bearer token — no shared npm package.
- **Logging**: POST structured JSON to `{LOGGING_SERVICE_URL}{LOGGING_SERVICE_API_PATH}` with `{service, level, msg, duration_ms, timestamp}`.
- **DB**: Each service has its own database (see `PORT_ALLOCATION.md`). Use `DATABASE_URL` or `DB_*` vars.
- **Notifications**: POST to `{NOTIFICATION_SERVICE_URL}` — handles email/Telegram/WhatsApp.
- **Payments**: All payment capture via `{PAYMENTS_MICROSERVICE_URL}` — never handle payment directly.

## Secrets

Never hardcode credentials. All secrets via Vault: `secret/prod/speakasap`. See `../../../shared/docs/VAULT.md`.
