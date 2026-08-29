# Validation Debt Ledger

## Purpose

Record known validation failures that are not caused by the current task, so agents can separate existing repo debt from real regressions.

## Rules

- This ledger does not excuse current-task failures.
- Every entry needs an owner, scope, and unblock condition.
- Do not include secrets, tokens, raw production data, customer identifiers, or private evidence.
- If a failure starts affecting the current task, promote it from debt to blocker.

## Entries

| ID | Date | Command | Failure Summary | Scope | Owner | Blocks Current Task? | Unblock Condition | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VD-001 | 2026-08-29 | `python3 scripts/check-seven-no-write-suite.py --json-report /tmp/seven-no-write-suite.json` | The suite defaults to expired `/tmp/speakasap-seven-dry-run-v20.json` and stops with `FileNotFoundError` before the asset contract. | Seven migration validation harness reproducibility | SpeakASAP migration maintainer | no | Regenerate every declared `DEFAULT_INPUTS` artifact in sequence, or replace ephemeral defaults with stable fixtures and explicit input arguments. | Targeted assets-host, deployment-readiness, approval-sequence, Python compile, and shell syntax checks pass independently. |

## Current-Task Decision Checklist

- Does the failing command touch files changed by this task?
- Does the failure mention this task ID, goal ID, or changed module?
- Is the failure already listed above with `Blocks Current Task? = no`?
- Did the failure exist before this task started?
- Is the validation command required by the current task acceptance criteria?

## Agent Reporting Format

```text
Validation debt check:
- Command:
- Result:
- Matched ledger entry:
- Current-task impact:
- Next action:
```

Next step: Keep entries current whenever validation failures are classified as out of scope.
