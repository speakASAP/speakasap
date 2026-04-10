# AGENT26: Assessment Service — Implementation

## Role

Backend Service Agent (Implementation) for **speakasap-assessment-service**.

## Objective

Implement the NestJS assessment service per **frozen** `ASSESSMENT_API_CONTRACT.md` and `ASSESSMENT_DATA_MAPPING.md`.

---

## Inputs

- `docs/refactoring/ASSESSMENT_API_CONTRACT.md` (**frozen**)
- `docs/refactoring/ASSESSMENT_DATA_MAPPING.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `speakasap/assessment-service/` scaffold (TASK-21)
- TASK-25 + **AGENT25V** outcome **PASS**

## Scope

- Controllers, services, persistence, scoring logic per contract.
- Logging with timestamps and `duration_ms` on outbound calls.
- Validation and error shapes per contract.

## Do

- Implement all contract endpoints and behaviors.
- Enforce list `limit` ≤ 30.
- Env-only configuration.

## Do Not

- Do not implement anything for `teacher_tests`.
- Do not change contract without re-validation path.
- Do not modify forbidden shared microservice repos.
- Do not add automated tests unless explicitly requested.

## Outputs

- `speakasap/assessment-service/src/` — implementation
- Updated `README.md`

## Exit Criteria

- `npm run build` passes.
- **Next:** `docs/agents/AGENT26V_ASSESSMENT_IMPLEMENTATION_VALIDATE.md` → **PASS**.
