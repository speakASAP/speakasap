# AGENT69: Phase 5 - Frontend Scaffold (TASK-69)

## Role

Frontend Agent: bootstrap `speakasap-frontend` with gateway-only integration boundaries.

## Objective

Create baseline frontend scaffold (Next.js) with env wiring to gateway, shared layout shell, and role-aware app entry structure.

## Prerequisites

- **P5-GE** PASS.

## Inputs

- `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md` - TASK-69
- `docs/refactoring/ROADMAP.md` - Phase 5.2
- `docs/refactoring/GATEWAY_API_CONTRACT.md`
- Existing service/frontend conventions in repository

## Scope

1. Scaffold `speakasap-frontend` app structure.
2. Wire frontend runtime to gateway base URL from env only.
3. Prepare baseline route/layout shells for learner/teacher/admin.

## Do

- Keep all backend communication through gateway only.
- Use root `.env`/`.env.example` key discipline (no secrets in `.env.example`).
- Keep scaffold minimal and implementation-ready for TASK-70/71.

## Do Not

- Do not call domain services directly from frontend.
- Do not hardcode API URLs or credentials.
- Do not add unrelated feature implementation in scaffold task.
- Do not self-run `AGENT69V` - hand to Validator.

## Outputs

- `frontend/` scaffold with run/build instructions.

## Exit Criteria

- Frontend build passes.
- Gateway URL is env-driven only.
- **Next:** `docs/agents/AGENT69V_FRONTEND_SCAFFOLD_VALIDATE.md` -> **PASS** for sync **P5-FA**.
