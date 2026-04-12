# speakasap-user-service

Phase 3 Wave 1 — user domain (`USER_API_CONTRACT.md`, `USER_DATA_MAPPING.md`).

| Item | Value |
| ---- | ----- |
| Default port | **4207** (`PORT`) |
| Target PostgreSQL database | **`speakasap_user_db`** (`DATABASE_URL`) |
| HTTP API prefix | `/api/v1` (health: `GET /health` without prefix) |

## Local run (Node)

1. Copy `.env.example` to `.env` and fill required keys (see `.env.example`).
2. Apply DB schema: `npx prisma migrate deploy` (against `speakasap_user_db`).
3. `npm install`
4. `npm run build`
5. `npm start`
6. Health: `curl -s http://localhost:${PORT:-4207}/health`

## Manual smoke (after DB + env)

```bash
# Health (no auth)
curl -s "http://localhost:${PORT:-4207}/health"

# Student self (requires real JWT from auth-microservice)
curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "http://localhost:${PORT:-4207}/api/v1/students/me"

# Internal batch (requires INTERNAL_API_TOKEN)
curl -s -X POST "http://localhost:${PORT:-4207}/api/v1/internal/students/upsert-by-auth-user" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${INTERNAL_API_TOKEN}" \
  -d '{"items":[{"authUserId":"<UUID>","country":"ru"}]}'
```

## ETL (TASK-32)

See `docs/refactoring/USER_DATA_MIGRATION_LOG.md` and run `scripts/migrate-user-from-legacy.py` (`--dry-run`, optional `--truncate-first`).

## Docker

```bash
docker compose build && docker compose up -d
curl -s "http://localhost:${PORT:-4207}/health"
```

## Docs

- Contract: `docs/refactoring/USER_API_CONTRACT.md`
- Mapping: `docs/refactoring/USER_DATA_MAPPING.md`
- **AGENT31V (2026-04-12):** `npm run build` OK; route inventory matches contract (students/teachers/managers/employee-profiles + internal batch); list cap enforced via `MAX_PAGE_SIZE` / `getPaginationParams`; no hardcoded URLs in `src/`; request logging with ISO timestamps + `duration_ms` in `RequestContextMiddleware`. Run `/health` and curl smoke against a live DB + auth when available.
- **AGENT32V (2026-04-12):** PASS (script + docs + target schema/orphan SQL). Run live `migrate-user-from-legacy.py` when `ssh speakasap` works (add `IdentityFile` under `Host speakasap` in `~/.ssh/config`).
- **AGENT33V (2026-04-12):** PASS — see `docs/refactoring/PHASE3_USER_VALIDATION_REPORT.md` (**P3-UE**).
