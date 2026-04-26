# AGENT67V: Validator - API Gateway Integration Validation (TASK-67)

## Role

QA / Contract Validator. Read-only verification of TASK-67 smoke validation outputs.

## Objective

Clear sync **P5-GD** by confirming gateway integration evidence is complete and contract-aligned.

## Preconditions

- TASK-67 output submitted.
- `PHASE5_GATEWAY_SMOKE_MATRIX.md` exists.

## Verification Scope

1. Smoke matrix covers `/health`, auth-required routes, route-family forwarding, and failure mapping.
2. Matrix includes `401`, `403`, `429`, `502`, `504` behavior rows.
3. Internal routes are marked non-public by default.
4. `limit <= 30` behavior is explicitly verified.
5. Deferred rows include owner + unblock condition (no vague deferrals).

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Smoke matrix exists | file check | path |
| Coverage completeness | inspect matrix sections | route/auth/error rows |
| Error semantics | inspect status-code rows | `401/403/429/502/504` |
| Internal boundary | inspect policy rows | `/api/v1/internal/**` handling |
| List limit policy | inspect rows for `limit <= 30` | evidence row |
| Deferred quality | inspect deferred entries | owner + unblock |

## Commands (examples)

- `rg "401|403|429|502|504|internal|limit|30|DEFERRED|owner" docs/refactoring/PHASE5_GATEWAY_SMOKE_MATRIX.md`

## Sync gate (before TASK-68)

- **P5-GD:** PASS / FAIL

## Verdict

PASS or FAIL with evidence.

### If FAIL

- List defects with exact paths.
- Return implementation to `docs/agents/AGENT67_GATEWAY_INTEGRATION_VALIDATION.md`.
- Do not clear **P5-GD** until PASS.
