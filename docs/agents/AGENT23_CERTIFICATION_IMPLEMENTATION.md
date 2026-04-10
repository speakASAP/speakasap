# AGENT23: Certification Service — Implementation

## Role

Backend Service Agent (Implementation) for **speakasap-certification-service**.

## Objective

Implement the NestJS certification service per **frozen** `CERTIFICATION_API_CONTRACT.md` and `CERTIFICATION_DATA_MAPPING.md`.

---

## Inputs

- `docs/refactoring/CERTIFICATION_API_CONTRACT.md` (**frozen**)
- `docs/refactoring/CERTIFICATION_DATA_MAPPING.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `speakasap/certification-service/` scaffold (TASK-21)
- TASK-22 + **AGENT22V** outcome **PASS**

## Scope

- Controllers, services, persistence (Prisma or repo-standard ORM).
- Validation DTOs, error handling, logging with timestamps and `duration_ms` on outbound calls.
- Docker/build alignment with existing service patterns.

## Do

- Implement every endpoint and behavior described in the frozen contract.
- Enforce list `limit` ≤ 30.
- Use `.env` for DB URL, port, logging URL, auth-related URLs if needed.
- Log errors at appropriate levels; no silent failures on PDF or external calls.

## Do Not

- Do not change contract without Lead Orchestrator approval and TASK-22 re-validation.
- Do not modify forbidden shared microservice repos.
- Do not run full data migration (TASK-24).
- Do not add automated tests unless explicitly requested.
- Do not increase timeouts to mask hangs — log and fix root cause.

## Outputs

- Implemented codebase under `speakasap/certification-service/src/`
- Updated `speakasap/certification-service/README.md` (endpoints, env vars, run instructions)

## Exit Criteria

- `npm run build` passes.
- Manual smoke checklist completed (see Validator).
- **Next:** `docs/agents/AGENT23V_CERTIFICATION_IMPLEMENTATION_VALIDATE.md` → **PASS**.
