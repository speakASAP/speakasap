# speakasap-user-service

Phase 3 Wave 1 — user domain microservice scaffold (**TASK-29**).

| Item | Value |
| ---- | ----- |
| Default port | **4207** (`PORT`) |
| Target PostgreSQL database | **`speakasap_user_db`** (via `DATABASE_URL` / `DB_NAME`) |
| HTTP API prefix (reserved) | `/api/v1` (no domain routes in this scaffold) |
| Health | `GET /health` → `{ "status": "ok" }` (no prefix) |

Auth integration and user APIs are **TASK-30+**; this service only validates env, boots NestJS, and exposes health plus logging hooks.

## Local run (Node)

1. Copy `.env.example` to `.env` and fill required keys (`PORT`, `SERVICE_NAME`, `DATABASE_URL`, logging vars).
2. `npm install`
3. `npm run build`
4. `npm start`
5. Check health: `curl -s http://localhost:${PORT:-4207}/health`

## Local run (Docker)

From this directory:

```bash
docker compose build && docker compose up -d
curl -s "http://localhost:${PORT:-4207}/health"
```

## Next step

**TASK-30** — `docs/agents/AGENT30_USER_SERVICE_DESIGN.md` (API contract and data mapping).
