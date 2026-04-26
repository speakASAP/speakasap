# AGENT68V: Validator - Gateway Wave Validation and Cutover Prep (TASK-68)

## Role

Meta-validator for gateway wave closure. Read-only verification of TASK-68 outputs.

## Objective

Clear sync **P5-GE** only when gateway wave artifacts are complete, evidence-backed, and operationally actionable.

## Preconditions

- TASK-68 output submitted.
- `PHASE5_GATEWAY_VALIDATION_REPORT.md` and `PHASE5_GATEWAY_CUTOVER_CHECKLIST.md` exist.

## Verification Scope

1. Validation report has explicit gate table for `P5-GA..P5-GD` and final GO/NO-GO.
2. Gate claims match evidence from prior artifacts (contracts + smoke matrix).
3. Deferred items include owner and unblock criteria (no vague TODOs).
4. Cutover checklist contains deploy, HTTP smoke, rollback, and logging verification steps.
5. No policy violations (hardcoded config, nginx-side business logic, contract bypass).

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Output docs present | file check | paths |
| Gate table completeness | inspect validation report | `P5-GA..P5-GD` rows |
| Evidence parity | cross-check with TASK-64..67 artifacts | cited docs |
| Deferred quality | inspect deferred entries | owner + unblock |
| Cutover readiness | inspect checklist | deploy/smoke/rollback rows |
| Policy compliance | scan report/checklist language | no violations |

## Commands (examples)

- `rg "P5-GA|P5-GB|P5-GC|P5-GD|GO|NO-GO|DEFERRED|owner|rollback" docs/refactoring/PHASE5_GATEWAY_*.md`

## Sync gate (before TASK-69)

- **P5-GE:** PASS / FAIL

## Verdict

PASS or FAIL with evidence.

### If FAIL

- List defects with exact paths.
- Return implementation to `docs/agents/AGENT68_GATEWAY_PHASE5_VALIDATION.md`.
- Do not clear **P5-GE** until PASS.
