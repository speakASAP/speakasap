# Validation Debt Ledger

## purpose

This ledger records known validation failures that are not caused by the current task so that agents can separate existing debt from real regressions.

## rules

- Validation debt does not excuse current-task failures.
- Every entry requires scope and owner information.
- Keep entries sanitized and avoid secret or private operational data.
- Promote a debt item to blocker status when the failure affects the active task.

## entries

| ID | Date | Command | Failure Summary | Scope | Owner | Blocks Current Task? | Unblock Condition | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VD-001 | 2026-08-29 | `python3 scripts/check-seven-no-write-suite.py --json-report /tmp/seven-no-write-suite.json` | The suite defaults to expired `/tmp/speakasap-seven-dry-run-v20.json` and stops with `FileNotFoundError` before the asset contract. | Seven migration validation harness reproducibility | SpeakASAP migration maintainer | no | Regenerate every declared `DEFAULT_INPUTS` artifact in sequence, or replace ephemeral defaults with stable fixtures and explicit input arguments. | Targeted assets-host, deployment-readiness, approval-sequence, Python compile, and shell syntax checks pass independently. |

## update format

Record every validation-debt classification decision using the following reporting format before treating a failure as pre-existing debt rather than a current-task regression.

```text
Validation debt check:
- Command:
- Result:
- Matched ledger entry:
- Current-task impact:
- Next action:
```

## current-task decision checklist

- Does the failing command touch files changed by this task?
- Does the failure mention this task ID, goal ID, or changed module?
- Is the failure already listed above with `Blocks Current Task? = no`?
- Did the failure exist before this task started?
- Is the validation command required by the current task acceptance criteria?
