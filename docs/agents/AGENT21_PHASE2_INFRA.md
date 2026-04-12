# AGENT21: Phase 2 Infrastructure — Certification & Assessment Scaffolds

## Role

Infra/Docker Agent responsible for adding **speakasap-certification-service** and **speakasap-assessment-service** scaffolds to the `speakasap` monorepo.

## Objective

Create minimal NestJS applications for Phase 2 (ports **4202** and **4203**), wired for env-driven config, centralized logging, and `/health`, consistent with `content-service` patterns.

---

## Inputs

- `docs/refactoring/PHASE2_TASK_DECOMPOSITION.md` — TASK-21
- `docs/refactoring/ROADMAP.md` — Phase 2
- `docs/infrastructure/PORT_ALLOCATION.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `speakasap/content-service/` — structural reference
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

## Scope

- Add `certification-service/` and `assessment-service/` under `speakasap/`.
- Integrate with root `docker-compose.yml` and deployment story **as already established** for Phase 1 (extend; do not redesign nginx-microservice code).
- **`speakasap/.env.example`** at repo root only (keys only, no secrets); **`speakasap/.env`** holds values for all SpeakASAP services here (`ENV_MONOREPO.md`).

## Do

- Scaffold NestJS apps with:
  - `GET /health` (or global prefix pattern matching `content-service`)
  - Env validation module if used elsewhere in repo
  - Logging client wiring toward `LOGGING_SERVICE_URL` (same pattern as `content-service`)
- Document in each service `README.md`: port, DB name, next steps (TASK-22 / TASK-25).
- Ensure `npm install` and `npm run build` succeed in each new service directory.
- Use database names: `speakasap_certification_db`, `speakasap_assessment_db` (document in README and **`speakasap/.env.example`**).

## Do Not

- Do not implement domain APIs (certificates, tests, PDF, quests) — TASK-23 / TASK-26.
- Do not modify `database-server`, `auth-microservice`, `nginx-microservice`, or `logging-microservice` **repositories**.
- Do not hardcode URLs, hosts, or secrets.
- Do not add automated tests unless explicitly requested.
- Do not run TASK-21 Validator yourself — hand off to Validator agent.

## Outputs

- `speakasap/certification-service/` — scaffold, `README.md`, `Dockerfile` if pattern requires (env: monorepo root only)
- `speakasap/assessment-service/` — same
- Updates to root compose / scripts / `README.md` if required for Phase 2 services

## Exit Criteria

- Both services build.
- `/health` documented and manually reachable when run locally (document how).
- Ports 4202 / 4203 and DB names documented.
- **Next step:** run `docs/agents/AGENT21V_PHASE2_INFRA_VALIDATE.md` and obtain **PASS** before TASK-22 / TASK-25.
