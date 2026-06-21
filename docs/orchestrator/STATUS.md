## 2026-06-15 - Goal 5.5 ExternalSecret Apply Attempt And Rollback

Status: blocked on missing Vault property for `LESSON_RECORD_MEDIA_TOKEN_SECRET`.

Approval:

- Owner approved applying the updated education-service ExternalSecret/manifest in chat on 2026-06-15: "Yes, I approve it. Go ahead, continue."

Execution:

- Ran `kubectl apply -f k8s/services/education-service.yaml` on `alfares`.
- Kubernetes reported Deployment, Service, and ConfigMap unchanged; `externalsecret.external-secrets.io/speakasap-education-secret configured`.
- Waited for ESO sync and checked only secret key names/status metadata; no secret values were printed.

Result:

- ESO failed to sync after the new `LESSON_RECORD_MEDIA_TOKEN_SECRET` mapping was applied.
- Condition after apply: `Ready=False`, `Reason=SecretSyncedError`, message `could not get secret data from provider`.
- Live Secret did not receive `LESSON_RECORD_MEDIA_TOKEN_SECRET`.
- Rolled back the live cluster resource with `/tmp/speakasap-education-service.yaml.before-token-secret`.
- Rollback restored `ExternalSecret` health: `Ready=True`, `Reason=SecretSynced`, refresh time `2026-06-15T12:53:18Z`.
- Existing recording storage keys remained present: `RECORDS_S3_ENDPOINT_URL`, `RECORDS_S3_BUCKET`, `RECORDS_S3_ACCESS_KEY`, `RECORDS_S3_SECRET_KEY`, `RECORDS_S3_REGION_NAME`, `RECORDS_S3_VERIFY_SSL`, and `RECORDS_S3_HELPER_URL`.

Boundary:

- No deployment rollout, pod restart, migration write, object-storage mutation, runtime smoke, salary write, payout call, rollback SQL, cutover, or secret value disclosure was run.
- The repository manifest still contains the desired `LESSON_RECORD_MEDIA_TOKEN_SECRET` mapping; the live cluster was rolled back because Vault does not currently provide the property.

Next:

- Create or authorize the Vault property `secret/prod/speakasap/education:LESSON_RECORD_MEDIA_TOKEN_SECRET`, then re-apply the education ExternalSecret and confirm the key syncs before deployment/runtime smoke.

## 2026-06-13 - Goal 5.5 Live Secret Sync Check

Status: blocked for deployment smoke; live ExternalSecret has not been updated with `LESSON_RECORD_MEDIA_TOKEN_SECRET`.

Evidence:

- `kubectl get externalsecret speakasap-education-secret -n statex-apps` reports `Ready=True`, `Reason=SecretSynced`, refresh time `2026-06-13T21:10:48Z`.
- Live `speakasap-education-secret` contains `RECORDS_S3_ENDPOINT_URL`, `RECORDS_S3_BUCKET`, `RECORDS_S3_ACCESS_KEY`, `RECORDS_S3_SECRET_KEY`, `RECORDS_S3_REGION_NAME`, `RECORDS_S3_VERIFY_SSL`, and `RECORDS_S3_HELPER_URL`.
- Live `speakasap-education-secret` does not contain `LESSON_RECORD_MEDIA_TOKEN_SECRET`.
- Live `ExternalSecret.spec.data` also does not contain `LESSON_RECORD_MEDIA_TOKEN_SECRET`.
- Repository manifest `k8s/services/education-service.yaml` does contain the `LESSON_RECORD_MEDIA_TOKEN_SECRET` mapping, so the repo change is present but not applied to the cluster.
- Live `speakasap-education` deployment is currently healthy: observed generation matches generation and `readyReplicas=1/1`.

Verification:

- Read-only Kubernetes checks only; no manifest apply, rollout, deployment, migration write, object-storage mutation, runtime smoke, or cutover was run.
- No secret values were printed; only key names and status metadata were inspected.

Next:

- Apply only the updated education-service ExternalSecret/manifest after explicit approval, wait for ESO sync, confirm `LESSON_RECORD_MEDIA_TOKEN_SECRET` appears in the live Secret, then proceed to deployment approval/runtime smoke.

## 2026-06-13 - Goal 5.5 Runtime Token Hardening And Secret Wiring

Status: done for pre-deploy hardening; deployment remains approval-gated.

Changed:

- Hardened `education-service/src/lesson-records/media-token.service.ts` so malformed token payloads return controlled `UnauthorizedException('Invalid media token')`.
- Added `LESSON_RECORD_MEDIA_TOKEN_SECRET` to `k8s/services/education-service.yaml` ExternalSecret.
- Updated `education-service/scripts/verify-lesson-record-runtime-contract.js` to assert token hardening and media-token secret wiring.

Verification:

- `cd education-service && npm run test:lesson-records` passed on `alfares`.
- `cd education-service && npm run build` passed on `alfares`.
- No deployment, rollout, migration write, object-storage mutation, salary write, payout call, rollback, or cutover ran.

Remaining gates:

- Deployment and runtime smoke still require explicit owner approval.
- Vault/ExternalSecret value sync for `LESSON_RECORD_MEDIA_TOKEN_SECRET`, `RECORDS_S3_*`, and `RECORDS_S3_HELPER_URL` must be confirmed before smoke.
- Merge/delete object mutation and frontend/gateway cutover remain separately approval-gated.

Next:

- Request owner approval for the `speakasap-education` deployment packet only after secret sync is confirmed.

## 2026-06-13 - Salary Draft Calculation Smoke 2026-05

Status: owner-approved scoped draft calculation smoke completed; payout gate remains disabled.

Approval:

- Approval packet: `docs/orchestrator/SALARY_CALCULATION_RUN_APPROVAL.md`.
- Owner approved proceeding in chat on 2026-06-13: "Agree, go ahead."

Execution:

- Temporarily ran current `education-service` locally on `127.0.0.1:14206`.
- Temporarily port-forwarded target Postgres on `127.0.0.1:15434` and user-service on `127.0.0.1:14207`.
- Set `SALARY_CALCULATION_RUNS_ENABLED=true` only in the temporary smoke process.
- Kept `SALARY_PAYOUT_FLOWS_ENABLED=false`.
- Scoped the calculation request to the 14 legacy portal user IDs from `/tmp/speakasap-salary-readiness-2026-05.json`.

Artifacts:

- Draft calculation report: `/tmp/speakasap-salary-calculation-run-2026-05-v1.json`.
- Rollback SQL: `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v1.sql`.
- Calculation run ID: `6576ac90-526e-47c6-8755-9631a4fb3149`.

Result:

- `calculation_runs.status=draft`.
- Period: `2026-05`.
- Rules version: `salary-duration-v3-imported-legacy-qty-v1`.
- Calculation lines: `14`.
- Payout runs for this calculation run: `0`.
- Payment disbursements: `0`.
- First line evidence shows `lessonSalaryHoursSource=imported_legacy_lesson_salary_expenses`, `importedLessonSalaryQtyHours=14`, and `aggregateLessonSalaryQtyHours=13.78333333333333`.

Verification:

- DB verification query confirmed the run exists, has `14` calculation lines, and has `0` payout runs.
- Temporary ports `14206`, `14207`, and `15434` are no longer listening after cleanup.

Boundary:

- No payout run, payout commit, payment/disbursement, salary expense/profile mutation, education row write, user row write, legacy row write, schema migration, deployment, destructive operation, or legacy retirement ran.
- The draft calculation run remains in target DB and can be removed with `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v1.sql` if needed.

Next:

- Review the draft calculation report before any broader calculation enablement. Payouts remain blocked until separate payment-boundary approval and `SALARY_PAYOUT_FLOWS_ENABLED=true`.

## 2026-06-13 - Salary Calculation Preview Parity 2026-05

Status: no-write calculation preview evidence completed; calculation and payout gates remain disabled.

Evidence:

- Source readiness report: `/tmp/speakasap-salary-readiness-2026-05.json`.
- Short-record reconciliation report: `/tmp/speakasap-salary-short-record-reconciliation-2026-05.json`.
- Calculation preview report: `/tmp/speakasap-salary-calculation-preview-2026-05.json`.
- Report recorded `writes=false`.
- Temporary target DB port-forward `127.0.0.1:15434` was used and is no longer listening.
- The preview applied the implemented policy: imported historical lesson salary expenses override education recording aggregate hours for profile/month rows when present.

Result:

- Profiles: `14`.
- Preview lines: `14`.
- Lines using imported lesson salary hours: `14`.
- Short/missing-duration blocker samples: `6`.
- Blocker samples covered by exact imported `salary_expenses.lesson_uuid`: `6`.
- Calculation run created: `false`.

Boundary:

- `SALARY_CALCULATION_RUNS_ENABLED` remains disabled by default.
- `SALARY_PAYOUT_FLOWS_ENABLED` remains disabled by default.
- No salary calculation run, payout run, payment/disbursement, salary row write, education row write, legacy row write, schema migration, deployment, destructive operation, or legacy retirement ran.

Next:

- If owner wants to enable salary calculation runs, prepare an approval packet to set `SALARY_CALCULATION_RUNS_ENABLED=true` and run a gated draft calculation smoke. Payouts remain blocked until separate payment-boundary approval and `SALARY_PAYOUT_FLOWS_ENABLED=true`.

## 2026-06-13 - Salary Historical Quantity Preservation

Status: code implemented; calculation and payout gates remain disabled.

Changed:

- Updated `salary-service/src/calculation-runs/calculation-runs.service.ts`.
- Calculation creation now loads imported `SalaryExpenseKind.lesson` rows for the requested period and selected legacy portal user IDs.
- When imported historical lesson salary expenses exist for a profile/month, the calculation line uses the stored imported `qty` hour sum instead of recomputing those lesson hours from education recording duration.
- Calculation line breakdown now records:
  - `lessonSalaryHoursSource`
  - `importedLessonSalaryExpenseCount`
  - `importedLessonSalaryQtyHours`
  - `aggregateLessonSalaryQtyHours`
  - richer education aggregate counters for demo, missing record, missing duration, and short-record evidence.
- Aggregate readiness validation now allows short-record or missing-duration blockers only when every reported blocker sample is covered by an exact imported `salary_expenses.lesson_uuid`; teacher-mapping blockers and dependency warnings remain hard blockers.

Evidence:

- This implements the policy implied by `/tmp/speakasap-salary-short-record-reconciliation-2026-05.json`: imported historical rows preserve legacy salary expense quantities, while target duration recalculation would underpay the six short-record lessons.
- The calculation env gate remains active: `SALARY_CALCULATION_RUNS_ENABLED=true` is still required before the create endpoint can write a calculation run.
- Payout gates remain active and separate: `SALARY_PAYOUT_FLOWS_ENABLED=true` is still required before payout create/commit can run.

Verification:

- `cd salary-service && npm run build` passed.
- No salary calculation run was created.
- No payout run, payment/disbursement, salary row write, education row write, legacy row write, schema migration, deployment, destructive operation, or legacy retirement ran.

Next:

- Rerun no-write salary readiness/parity evidence with the current code path before considering `SALARY_CALCULATION_RUNS_ENABLED=true`. Payouts remain separately blocked pending payment-boundary approval.

## 2026-06-13 - Salary Short-Record Reconciliation 2026-05

Status: no-write short-record reconciliation completed; salary calculation and payout gates remain disabled.

Evidence:

- Source readiness report: `/tmp/speakasap-salary-readiness-2026-05.json`.
- Reconciliation report: `/tmp/speakasap-salary-short-record-reconciliation-2026-05.json`.
- Report recorded `writes=false`.
- Used existing legacy source DB endpoint `127.0.0.1:15432` and a temporary target DB port-forward `127.0.0.1:15434`; the temporary target port is no longer listening.
- Legacy behavior evidence reviewed:
  - `expenses/salary/utils.py::get_record_length_in_hours()`
  - `expenses/salary/utils.py::check_expense_qty()`
  - `portal/utils/numbers.py::quantize()`
  - `education/models.py::Lesson.duration`
- Legacy `Lesson.duration` is a computed property, not a DB column, so reconciliation used the readiness report's `scheduledMinutes`.

Result:

- Rows reconciled: `6`.
- Missing legacy lesson salary expenses: `0`.
- Missing duration rows: `0`.
- Missing teacher mappings: `0`.
- All six rows have imported target salary expense rows with `qty=1.0000`, matching legacy stored salary expense quantity.
- All six rows would be undercounted by the current target aggregate's recording-duration calculation because their MP3 duration is below the full-lesson tolerance.

Row outcomes:

| Lesson UUID | Legacy expense | Legacy qty | Duration seconds | Current target hours | Legacy stored vs target delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| `9630fdfc-2c57-4c08-822f-ba85ed339527` | `106524` | `1.00` | `3108` | `0.87` | `-0.13` |
| `9169ce77-4167-48e6-bb11-d1579964b11a` | `106536` | `1.00` | `2155` | `0.60` | `-0.40` |
| `4668280d-468c-49a4-b135-91bfbc15fb16` | `106556` | `1.00` | `60` | `0.02` | `-0.98` |
| `d3e59e96-d010-4040-baae-0518e3838dce` | `106577` | `1.00` | `3209` | `0.88` | `-0.12` |
| `a0508fd4-5195-40eb-9eb7-49daa2348dd7` | `106597` | `1.00` | `2890` | `0.80` | `-0.20` |
| `7355b9de-dbdd-4089-ac8e-ac862b512a64` | `106696` | `1.00` | `3296` | `0.92` | `-0.08` |

Interpretation:

- The remaining blocker is not missing data. It is a historical parity policy decision: imported legacy salary expenses preserve `qty=1.00` for these short-record lessons, while recalculating from current recording durations would reduce pay.
- Salary calculation runs must remain disabled until the target calculation path preserves imported legacy salary quantities for historical rows or the owner explicitly approves recomputing historical salary from MP3 duration.

Boundary:

- No salary calculation run, payout run, payment/disbursement, salary row write, education row write, legacy row write, schema migration, deployment, destructive operation, or legacy retirement ran.

Next:

- Implement or approve the historical salary parity policy: for imported historical lesson salary rows, calculation previews should use imported `salary_expenses.qty` instead of recomputing from recording duration; only after that should `SALARY_CALCULATION_RUNS_ENABLED` be considered. Payouts remain separately gated by `SALARY_PAYOUT_FLOWS_ENABLED` and payment-boundary approval.

## 2026-06-13 - Salary Readiness Report 2026-05

Status: no-write readiness report completed; salary calculation and payout gates remain disabled.

Evidence:

- Ran a temporary read-only evidence path on `alfares`:
  - port-forwarded `db-server-postgres` to `127.0.0.1:15434`;
  - port-forwarded `speakasap-user` to `127.0.0.1:14207`;
  - started the freshly built `education-service` from current `dist/main.js` on local-only port `14206`;
  - ran `salary-service/scripts/check-salary-readiness.ts` against `http://127.0.0.1:14206`.
- Report path: `/tmp/speakasap-salary-readiness-2026-05.json`.
- Report recorded `writes=false`.
- Script exit code was `2`, the expected blocker-present code.
- Readiness:
  - `salaryCalculationReady=false`
  - `missingDurationCount=0`
  - `shortRecordCount=6`
  - `teacherMappingMissingCount=0`
  - `missingTeacherMappingLegacyUserIds=[]`
- Totals:
  - `aggregateItems=14`
  - `finishedLessonCount=172`
  - `demoLessonCount=1`
  - `demoUnpaidLessonCount=0`
  - `demoPayableLessonCount=1`
  - `missingRecordCount=26`
  - `totalMinutes=10161`
- Short-record blocker samples:
  - `d3e59e96-d010-4040-baae-0518e3838dce`, teacher `181`, legacy user `168458`, start `2026-05-13T16:00:00.000Z`, scheduled `60`, duration seconds `3209`
  - `7355b9de-dbdd-4089-ac8e-ac862b512a64`, teacher `23`, legacy user `1655`, start `2026-05-29T07:00:00.000Z`, scheduled `60`, duration seconds `3296`
  - `a0508fd4-5195-40eb-9eb7-49daa2348dd7`, teacher `270`, legacy user `201136`, start `2026-05-13T17:00:00.000Z`, scheduled `60`, duration seconds `2890`
  - `9169ce77-4167-48e6-bb11-d1579964b11a`, teacher `182`, legacy user `3`, start `2026-05-06T10:00:00.000Z`, scheduled `60`, duration seconds `2155`
  - `9630fdfc-2c57-4c08-822f-ba85ed339527`, teacher `23`, legacy user `1655`, start `2026-05-04T16:00:00.000Z`, scheduled `60`, duration seconds `3108`
  - `4668280d-468c-49a4-b135-91bfbc15fb16`, teacher `182`, legacy user `3`, start `2026-05-08T10:00:00.000Z`, scheduled `60`, duration seconds `60`

Cleanup:

- Temporary service and port-forward ports `14206`, `14207`, and `15434` are no longer listening.

Boundary:

- No salary calculation run, payout run, payment/disbursement, salary row write, education row write, legacy row write, schema migration, deployment, destructive operation, or legacy retirement ran.

Next:

- Reconcile the six short-record rows against legacy salary expense quantities and owner policy before setting `SALARY_CALCULATION_RUNS_ENABLED=true` or `SALARY_PAYOUT_FLOWS_ENABLED=true`.

## 2026-06-13 - Salary Demo Parity And Run/Payout Gate

Status: no-write salary gate implemented; salary calculation runs and payout flows remain disabled by default.

Changed:

- Extended `education-service/src/internal-salary/internal-salary.service.ts` salary aggregates with targeted demo parity counters:
  - `demoUnpaidLessonCount`
  - `demoPayableLessonCount`
  - `scheduledMinutes`
  - `payableMinutes`
  - recording-derived payable minutes with five-minute full-lesson tolerance and scheduled-duration cap.
- Added aggregate readiness metadata and bounded blocker samples for:
  - missing `LessonRecord.durationSeconds` rows;
  - short-record rows requiring salary parity review;
  - requested legacy user IDs missing teacher mapping.
- Updated `salary-service/src/deps/education-client.service.ts` to consume aggregate readiness, warnings, and blocker samples.
- Updated `salary-service/src/calculation-runs/calculation-runs.service.ts` to refuse calculation creation unless `SALARY_CALCULATION_RUNS_ENABLED=true` and the education aggregate reports no missing-duration, short-record, teacher-mapping, or dependency-warning blockers.
- Updated `salary-service/src/payout-runs/payout-runs.service.ts` to refuse payout creation and payout commit unless `SALARY_PAYOUT_FLOWS_ENABLED=true`.
- Added no-write readiness command `salary-service/scripts/check-salary-readiness.ts` and package script `npm run check:salary-readiness`.

Evidence:

- Required RAG lookup to `docs-rag-microservice.statex-apps.svc.cluster.local:3397` failed with curl exit code `6`, so repository and remote code evidence were used.
- Owner explicitly reprioritized Goal 9 salary work after Goal 9 had been paused for Seven work; existing Seven changes were not reverted.
- Reviewed current remote dirty worktree before editing. Unrelated Seven/content-service/front-end changes are present and were left intact.
- Legacy salary parity evidence remains `docs/orchestrator/SALARY_MIGRATION_GOAL.md`, `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md`, and the prior no-write comparison `/tmp/speakasap-salary-aggregate-parity-v1.json`.

Verification:

- `cd salary-service && npm run build` passed.
- `cd education-service && npm run build` passed.
- `git diff --check -- education-service/src/internal-salary/internal-salary.service.ts salary-service/src/deps/education-client.service.ts salary-service/src/calculation-runs/calculation-runs.service.ts salary-service/src/payout-runs/payout-runs.service.ts salary-service/scripts/check-salary-readiness.ts salary-service/package.json` passed.
- `cd salary-service && ./node_modules/.bin/tsx scripts/check-salary-readiness.ts --period invalid --json-report /tmp/speakasap-salary-readiness-invalid.json` failed with expected validation message `--period must be YYYY-MM`.
- Attempted no-write report command:
  - `cd salary-service && set -a && test -f ../.env && . ../.env && set +a && npm run check:salary-readiness -- --period 2026-05 --json-report /tmp/speakasap-salary-readiness-2026-05.json`
  - Result: blocked before HTTP because `.env` has `INTERNAL_API_TOKEN` but no `EDUCATION_SERVICE_URL`.
  - K8s manifests identify the in-cluster education URL as `http://speakasap-education:4206`; the host shell cannot resolve the cluster service directly without a pod/port-forward/deployed command path.

Boundary:

- No salary calculation run, payout run, payment/disbursement, salary row write, education row write, legacy row write, schema migration, deployment, destructive operation, or legacy retirement ran.
- Payment execution remains owned by `payments-microservice`; salary-service payout flows are disabled unless an explicit environment gate is set after approval.
- Recording objects remain private and owned by MinIO/storage infrastructure; salary-service consumes only education aggregate metadata.

Next:

- Run `npm run check:salary-readiness -- --period <YYYY-MM> --json-report /tmp/speakasap-salary-readiness-<period>.json` from a context that can reach `http://speakasap-education:4206` with the internal token, then reconcile the reported missing-duration, short-record, and teacher-mapping samples before setting `SALARY_CALCULATION_RUNS_ENABLED=true` or `SALARY_PAYOUT_FLOWS_ENABLED=true`.

## 2026-06-13 - Salary Education Aggregate Parity Comparison

Status: no-write comparison completed; current target fallback aggregate is not salary-parity safe.

Evidence:

- Created read-only report `/tmp/speakasap-salary-aggregate-parity-v1.json` comparing legacy `education_lessonsalaryexpense` quantity minutes against target education fallback aggregate minutes for periods `2025-07` through `2026-06`.
- Temporary `kubectl -n statex-apps port-forward svc/db-server-postgres 15434:5432` was opened for the DB reads and then stopped.
- Report recorded `writes=false`.
- Compared teacher-period rows: `195`; exact matches `142`; mismatches `53`; missing target rows `1`; target-only rows `0`.
- Totals: legacy minutes `158520`; target fallback minutes `160170`; net delta `+1650` minutes.
- Largest deltas include legacy user `3` / teacher `182` in `2026-01` with `+480` target minutes, legacy user `197762` / teacher `227` in `2026-06` with `-300` target minutes, and legacy user `300800` / teacher `545` in `2026-01` with `+300` target minutes.

Interpretation:

- The current education aggregate uses documented fallback rules (`60` minutes non-demo, `30` minutes demo with record) because target lessons do not persist legacy scheduled duration or MP3 duration seconds.
- The comparison proves this fallback is useful for smoke coverage but cannot be used for salary calculation parity without recording-duration/scheduled-duration support or an approved changed payroll policy.

Boundary:

- No salary calculation run, payout run, payment/disbursement, salary row write, education row write, legacy row write, deployment, destructive operation, or legacy retirement ran.

Next:

- Implement recording-duration parity support or import legacy payroll duration evidence before enabling salary calculation runs or payout flows.

## 2026-06-13 - Goal 10 Operator Refusal Gate

Status: all seven runtime operators now have a no-write refusal gate in the validation suite.

Changed:

- Added `scripts/check-seven-operator-refusal.py`.
- Wired the checker into `scripts/check-seven-no-write-suite.py`.
- The checker runs schema, data, media, and deployment operators without `--execute` and requires exit code `2`, required approval usage text, and absence of external-action output.

Verification:

- `python3 -m py_compile scripts/check-seven-operator-refusal.py scripts/check-seven-no-write-suite.py` passed.
- `/tmp/speakasap-seven-operator-refusal-v1.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`; schema/data/media/deployment operators all returned `2` and no forbidden external-action output.
- `/tmp/speakasap-seven-no-write-suite-v17.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.

Boundary:

- No content-service Prisma migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, browser production QA, destructive rollback, or legacy route retirement ran.

Next:

- Execute approved runtime gates in order only after explicit approvals: schema, data, media, deployment, visual QA, then runtime evidence audit.

## 2026-06-13 - Goal 10 Runtime Evidence Chain Auditor

Status: final runtime execution evidence chain is now a first-class completion gate.

Changed:

- Added `scripts/check-seven-runtime-evidence.py`.
- Wired the runtime evidence auditor into `scripts/check-seven-no-write-suite.py`.
- Updated `scripts/check-seven-goal-completion.py` so completion requires `runtimeEvidenceChainComplete`.
- The auditor checks schema execution, schema reconciliation, data execution, post-apply data reconciliation, media execution, post-copy media availability, deployment execution, deployment smoke, and post-deploy visual QA as one coherent evidence chain.

Verification:

- `python3 -m py_compile scripts/check-seven-runtime-evidence.py scripts/check-seven-goal-completion.py scripts/check-seven-no-write-suite.py` passed.
- `/tmp/speakasap-seven-runtime-evidence-v1.json` recorded `writes=false`, `ok=true`, `complete=false`, with all runtime execution artifacts currently missing as expected before approvals.
- `/tmp/speakasap-seven-no-write-suite-v16.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.
- Completion audit now explicitly lists `runtimeEvidenceChainComplete` as pending.

Boundary:

- No content-service Prisma migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, browser production QA, destructive rollback, or legacy route retirement ran.

Next:

- Execute approved runtime gates in order: schema, data, media, deployment smoke, post-deploy visual QA, then rerun `scripts/check-seven-runtime-evidence.py` and the final completion audit.

## 2026-06-13 - Goal 10 Post-Deploy Visual QA Gate

Status: rendered post-deploy typography/browser QA is now an explicit completion gate.

Changed:

- Added `scripts/check-seven-postdeploy-visual-qa.js` for Playwright-based post-deploy rendered QA of the seven course and lesson pages on desktop and mobile viewports.
- Added `scripts/check-seven-visual-qa-contract.py` to verify the QA script contract without running browser/network checks.
- Updated `scripts/check-seven-goal-completion.py` so completion now requires both the static typography contract and a passing post-deploy visual QA report.
- Updated `scripts/check-seven-no-write-suite.py` to run `node --check scripts/check-seven-postdeploy-visual-qa.js` and the visual QA contract checker.
- Updated `docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md` with the required post-deploy visual QA command and evidence path.

Verification:

- `node --check scripts/check-seven-postdeploy-visual-qa.js` passed.
- `python3 -m py_compile scripts/check-seven-visual-qa-contract.py scripts/check-seven-goal-completion.py scripts/check-seven-no-write-suite.py` passed.
- `/tmp/speakasap-seven-visual-qa-contract-v1.json` recorded `writes=false`, `ok=true`, desktop/mobile, course/lesson, screenshot, console-health, framework-overlay, typography, and layout-collapse checks covered by the QA script.
- `/tmp/speakasap-seven-no-write-suite-v15.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.
- Completion audit now explicitly lists `postDeployVisualQaPassed` as pending, along with schema/data/deploy/cutover runtime gates.

Boundary:

- No browser/network QA was run against production because deployment/data/media gates are not complete yet.
- No content-service Prisma migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- After scoped deployment and smoke pass, run `node scripts/check-seven-postdeploy-visual-qa.js --base-url https://speakasap.alfares.cz --language-code en --lesson-order 1 --json-report /tmp/speakasap-seven-postdeploy-visual-qa-v1.json --screenshot-dir /tmp/speakasap-seven-visual-qa-v1`.

## 2026-06-13 - Goal 10 Gated Deployment Operator Script

Status: seven scoped deployment action is now a checked, write-gated operator script for the final deployment gate.

Changed:

- Added `scripts/deploy-seven-approved.sh`.
- Updated `docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md` so future deployment uses the gated operator.
- Extended `scripts/check-seven-deployment-readiness.py` to verify the operator exists, is executable, requires `--execute`, exact `SEVEN_DEPLOY_APPROVAL_TEXT`, ok schema/data/media execution reports, builds/pushes only scoped content/gateway/frontend images, applies only scoped manifests plus ingress, restarts/status-checks only scoped deployments, runs seven deployment smoke, writes an execution report, and does not invoke root `scripts/deploy.sh`.
- Extended `scripts/check-seven-no-write-suite.py` with `bash -n scripts/deploy-seven-approved.sh`.

Verification:

- `bash -n scripts/deploy-seven-approved.sh` passed.
- `scripts/deploy-seven-approved.sh` without `--execute` exited with status `2` before build/push/kubectl/smoke actions and printed the required approval usage.
- `python3 -m py_compile scripts/check-seven-deployment-readiness.py scripts/check-seven-no-write-suite.py` passed.
- `/tmp/speakasap-seven-deployment-readiness-v3.json` recorded `writes=false`, `ok=true`, `readyForOwnerDeploymentApproval=true`, `readyForCutover=false`, and `deployOperatorContract` all true.
- `/tmp/speakasap-seven-no-write-suite-v14.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.

Boundary:

- No content-service Prisma migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Finish schema, data, and media gates first. After separate deployment approval, run `scripts/deploy-seven-approved.sh --execute` with exact `SEVEN_DEPLOY_APPROVAL_TEXT` and schema/data/media execution reports.

## 2026-06-13 - Goal 10 Gated Media Copy Operator Script

Status: seven public media copy action is now a checked, write-gated operator script for the later media gate.

Changed:

- Added `scripts/copy-seven-media-approved.sh`.
- Updated `docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md` so any future media copy uses the gated operator.
- Extended `content-service/scripts/check-seven-media-approval-contract.py` to verify the media operator exists, is executable, requires `--execute`, exact `SEVEN_MEDIA_APPROVAL_TEXT`, a manifest with `writes=false`, `availableRefs=1212`, `missingRefs=0`, an existing `MEDIA_TARGET_ROOT`, copies only audio/PDF rows, preserves `media/...` target keys, runs post-copy availability, writes an execution report, and contains no deployment commands.
- Extended `scripts/check-seven-no-write-suite.py` with `bash -n scripts/copy-seven-media-approved.sh`.

Verification:

- `bash -n scripts/copy-seven-media-approved.sh` passed.
- `scripts/copy-seven-media-approved.sh` without `--execute` exited with status `2` before curl/copy actions and printed the required approval usage.
- `python3 -m py_compile content-service/scripts/check-seven-media-approval-contract.py scripts/check-seven-no-write-suite.py` passed.
- `/tmp/speakasap-seven-media-approval-contract-v2.json` recorded `writes=false`, `ok=true`, `approvalContractSafe=true`, `evidenceContractSafe=true`, and `operatorScriptContractSafe=true`.
- `/tmp/speakasap-seven-no-write-suite-v13.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.

Boundary:

- No content-service Prisma migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Finish schema and data gates first. After data is applied and a separate media approval is granted, run `scripts/copy-seven-media-approved.sh --execute` with exact `SEVEN_MEDIA_APPROVAL_TEXT` and an explicit `MEDIA_TARGET_ROOT` served by the asset host.

## 2026-06-13 - Goal 10 Gated Data Apply Operator Script

Status: seven content data apply action is now a checked, write-gated operator script for the post-schema gate.

Changed:

- Added `scripts/apply-seven-data-approved.sh`.
- Updated `docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md` so the future data apply uses the gated operator instead of a manual two-shell port-forward/apply sequence.
- Extended `content-service/scripts/check-seven-data-apply-contract.py` to verify the data operator exists, is executable, requires `--execute`, requires exact `SEVEN_DATA_APPROVAL_TEXT`, requires a passing schema reconciliation report, requires rollback SQL path, derives `CONTENT_TARGET_DATABASE_URL` from the Kubernetes secret, runs `--check-target --apply --include-languages --confirm-write`, reruns post-apply no-write verification, writes an execution report, records approval hash, and contains no deployment commands.
- Extended `scripts/check-seven-no-write-suite.py` with `bash -n scripts/apply-seven-data-approved.sh`.

Verification:

- `bash -n scripts/apply-seven-data-approved.sh` passed.
- `scripts/apply-seven-data-approved.sh` without `--execute` exited with status `2` before kubectl/importer actions and printed the required approval usage.
- `python3 -m py_compile content-service/scripts/check-seven-data-apply-contract.py scripts/check-seven-no-write-suite.py` passed.
- `/tmp/speakasap-seven-data-apply-contract-v10.json` recorded `writes=false`, `ok=true`, `approvalContractSafe=true`, and `operatorScriptContractSafe=true`.
- `/tmp/speakasap-seven-no-write-suite-v12.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.

Boundary:

- No content-service Prisma migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Finish the schema-only gate first. After schema reconciliation is `schemaReady=true`, request separate data approval using `docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md`, then run `scripts/apply-seven-data-approved.sh --execute` with exact `SEVEN_DATA_APPROVAL_TEXT`.

## 2026-06-13 - Goal 10 Schema Operator Execution Report

Status: schema-only operator now creates an audit report for the approved schema action.

Changed:

- Extended `scripts/apply-seven-schema-approved.sh` to write `/tmp/speakasap-seven-schema-apply-execution-v1.json` after a successful approved schema apply and post-schema no-write reconciliation.
- The execution report records `writes=true`, schema-only scope, `approvalSha256`, migration log path, target report path, reconciliation report path, `schemaReady`, `dataReady`, `ok`, and explicit false flags for data apply, media mutation, deployment, and legacy retirement approvals.
- Extended `content-service/scripts/check-seven-schema-migration-plan.py` so `operatorScriptContractSafe` also requires the execution report, approval hash, migration log, post-schema report paths, and later approval false flags.

Verification:

- `bash -n scripts/apply-seven-schema-approved.sh` passed.
- `scripts/apply-seven-schema-approved.sh` without `--execute` exited with status `2` before kubectl/prisma actions.
- `python3 -m py_compile content-service/scripts/check-seven-schema-migration-plan.py scripts/check-seven-no-write-suite.py` passed.
- `/tmp/speakasap-seven-schema-migration-plan-v9.json` recorded `writes=false`, `ok=true`, `operatorScriptContractSafe=true`, `writesExecutionReport=true`, `recordsApprovalHash=true`, `recordsMigrationLog=true`, `recordsPostSchemaReportPaths=true`, and `marksLaterApprovalsFalse=true`.
- `/tmp/speakasap-seven-no-write-suite-v7.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.

Boundary:

- No content-service Prisma migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, then run the gated `scripts/apply-seven-schema-approved.sh --execute` with exact `SEVEN_SCHEMA_APPROVAL_TEXT`.

## 2026-06-13 - Goal 10 Gated Schema Operator Script

Status: schema-only approval action is now a checked, write-gated operator script.

Changed:

- Added `scripts/apply-seven-schema-approved.sh`.
- Updated `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` so the approved schema action uses the gated script instead of a manual two-shell port-forward/migrate sequence.
- Extended `content-service/scripts/check-seven-schema-migration-plan.py` to verify the operator script exists, is executable, requires `--execute`, requires an exact `SEVEN_SCHEMA_APPROVAL_TEXT` match, derives `DATABASE_URL` from the Kubernetes secret, uses direct `npx prisma migrate deploy --schema prisma/schema.prisma`, runs the DB-backed target report and post-schema reconciliation checker, and contains no seven data apply or deployment commands.
- Extended `scripts/check-seven-no-write-suite.py` with `bash -n scripts/apply-seven-schema-approved.sh`.

Verification:

- `bash -n scripts/apply-seven-schema-approved.sh` passed.
- `scripts/apply-seven-schema-approved.sh` without `--execute` exited with status `2` before kubectl/prisma actions and printed the required approval usage.
- `python3 -m py_compile content-service/scripts/check-seven-schema-migration-plan.py scripts/check-seven-no-write-suite.py` passed.
- `/tmp/speakasap-seven-schema-migration-plan-v8.json` recorded `writes=false`, `ok=true`, `operatorScriptContractSafe=true`, and `schemaExecutionContractSafe=true`.
- `/tmp/speakasap-seven-no-write-suite-v6.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.

Boundary:

- No content-service Prisma migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, then run the gated `scripts/apply-seven-schema-approved.sh --execute` with the exact `SEVEN_SCHEMA_APPROVAL_TEXT`.

## 2026-06-13 - Goal 10 Fresh Baseline Suite Validation

Status: no-write suite passed with the fresh target schema baseline wired in.

Verification:

- `python3 -m py_compile content-service/scripts/check-seven-schema-migration-plan.py scripts/check-seven-no-write-suite.py content-service/scripts/check-seven-apply-readiness.py` passed.
- `/tmp/speakasap-seven-schema-migration-plan-v7.json` recorded `writes=false`, `ok=true`, `schemaExecutionContractSafe=true`, and `approvalEvidenceReferencesCurrent=true`.
- `/tmp/speakasap-seven-no-write-suite-v5.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.
- Completion remains false only for runtime gates: `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.

Boundary:

- No content-service Prisma migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, rerun DB-backed no-write seven reconciliation, and then run `check-seven-post-schema-reconciliation.py`.

## 2026-06-13 - Goal 10 Fresh Target Schema Baseline

Status: current target database was rechecked read-only; schema approval is still required.

Evidence:

- RAG lookup was skipped because `JWT_TOKEN` is not set in the remote shell; repository and DB evidence were used.
- `/tmp/speakasap-seven-dry-run-target-fresh-v1.json` recorded `writes=false`, `target.checked=true`, and blocking issue `TARGET_LANGUAGE_TABLE_UNAVAILABLE`.
- `/tmp/speakasap-seven-post-schema-reconciliation-fresh-v1.json` recorded `writes=false`, `ok=false`, `schemaReady=false`, `dataReady=false`, `complete=false`.
- Fresh assertions: `targetChecked=true`, `sourceWritesFalse=true`, `plannedCountsMatch=true`, `languageTableQueryable=false`, `sevenTablesQueryable=false`, `sevenTablesEmptyBeforeDataApply=false`, and `noLanguageTableUnavailableBlocker=false`.

Boundary:

- The command opened a temporary port-forward and performed read-only target reconciliation only.
- No content-service Prisma migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, rerun DB-backed no-write seven reconciliation, and then run `check-seven-post-schema-reconciliation.py`.

## 2026-06-13 - Goal 10 Schema Approval Packet Freshness Gate

Status: active schema-only approval packet now points to current no-write evidence.

Changed:

- Updated `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` to replace stale pre-schema target and schema-plan references with current post-schema-baseline, schema-plan, and no-write-suite evidence.
- Extended `content-service/scripts/check-seven-schema-migration-plan.py` so schema approval readiness fails if the active approval packet omits current evidence references or reintroduces stale `/tmp/speakasap-seven-dry-run-target-v14.json` / schema-plan v2 references.

Verification:

- `python3 -m py_compile content-service/scripts/check-seven-schema-migration-plan.py content-service/scripts/check-seven-apply-readiness.py scripts/check-seven-no-write-suite.py` passed.
- `/tmp/speakasap-seven-schema-migration-plan-v6.json` recorded `writes=false`, `ok=true`, `schemaExecutionContractSafe=true`, and `approvalEvidenceReferencesCurrent=true` after the version-family evidence check fix.
- `/tmp/speakasap-seven-no-write-suite-v4.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.
- The suite completion summary still lists only runtime gates as missing: `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, rerun DB-backed no-write seven reconciliation, and then run `check-seven-post-schema-reconciliation.py`.

## 2026-06-13 - Goal 10 Readiness Post-Schema Gate

Status: no-write readiness checker now requires post-schema reconciliation for data approval readiness.

Changed:

- Extended `content-service/scripts/check-seven-apply-readiness.py` with `--post-schema-reconciliation-report`.
- Data approval readiness now requires the data apply contract plus post-schema reconciliation evidence with `writes=false` and `schemaReady=true`.
- Current pre-schema reconciliation report is accepted as evidence of why data approval remains blocked, not as a passing data gate.

Verification:

- `python3 -m py_compile content-service/scripts/check-seven-apply-readiness.py` passed.
- `/tmp/speakasap-seven-apply-readiness-v7.json` recorded `writes=false`, `ok=true`, `complete=false`, schema gate ready, `postSchemaReconciliationReady=false`, `postSchemaDataReady=false`, `readyForOwnerDataApproval=false`, media source gate ready, and deploy gate not ready.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, rerun DB-backed no-write seven reconciliation, and then run `check-seven-post-schema-reconciliation.py`.

## 2026-06-13 - Goal 10 Post-Schema Reconciliation Checker

Status: no-write post-schema acceptance checker added; current pre-schema target correctly fails it.

Changed:

- Added `content-service/scripts/check-seven-post-schema-reconciliation.py` to validate the DB-backed target report after schema-only migration.
- The checker separates schema readiness from later data readiness: it requires `Language`, `SevenCourse`, `SevenLesson`, and `SevenExercise` to be queryable, the three seven tables to be empty before data apply, planned ids/keys to remain `19/136/429`, and no `TARGET_LANGUAGE_TABLE_UNAVAILABLE` blocker. Missing `Language` rows are treated as a later data approval condition, not as schema failure once the table exists.

Verification:

- `python3 -m py_compile content-service/scripts/check-seven-post-schema-reconciliation.py` passed.
- `/tmp/speakasap-seven-post-schema-reconciliation-fresh-v1.json` was generated from the current pre-schema target report and recorded `writes=false`, `ok=false`, `schemaReady=false`, `dataReady=false`.
- The failure is expected before schema apply: `sevenTablesQueryable=false`, `sevenTablesEmptyBeforeDataApply=false`, `languageTableQueryable=false`, while `plannedCountsMatch=true`.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- After explicit schema-only owner approval and content-service Prisma migration apply, rerun `migrate-seven-from-legacy.py --check-target`, then run `check-seven-post-schema-reconciliation.py` on that post-schema report before any data approval.

## 2026-06-13 - Goal 10 Completion Audit Checker

Status: no-write completion audit checker added; goal remains incomplete by current evidence.

Changed:

- Added `scripts/check-seven-goal-completion.py` to aggregate current readiness, deployment smoke, typography, route-file, content-service, and intent-preservation evidence against the full owner objective.
- The checker is intentionally stricter than readiness: it reports completion only when frontend/content, typography, intent docs, schema reconciliation, data readiness, media readiness, deployed smoke, and cutover readiness are all proven.

Verification:

- `python3 -m py_compile scripts/check-seven-goal-completion.py` passed.
- `/tmp/speakasap-seven-goal-completion-audit-v1.json` recorded `writes=false`, `ok=false`, `complete=false`.
- Completed/proven requirements in the audit: frontend routes implemented, content API implemented, typography static contract passed, intent-preservation docs present, approval packets present, schema ready for approval, and media source ready for approval.
- Missing requirements in the audit: `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, then rerun DB-backed no-write seven reconciliation.

## 2026-06-13 - Goal 10 Consolidated No-Write Validation

Status: consolidated validation passed; schema/data/media-copy/deploy gates remain owner-approval blocked.

Verification:

- `cd content-service && npm run build` passed.
- `cd api-gateway && npm run build` passed.
- `cd frontend && npm run build` passed; Next listed dynamic routes `/(languageCode)/seven` and `/(languageCode)/seven/[order]`.
- `python3 -m py_compile` passed for seven importer, readiness, schema-plan, data-apply contract, media availability/source/manifest, deployment smoke, and typography contract scripts.
- `/tmp/speakasap-seven-schema-migration-plan-v2.json` regenerated with `writes=false`, `ok=true`.
- `/tmp/speakasap-seven-data-apply-contract-v2.json` regenerated with `writes=false`, `ok=true`.
- `/tmp/speakasap-seven-typography-contract-v2.json` regenerated with `writes=false`, `ok=true`.
- `/tmp/speakasap-seven-apply-readiness-v6.json` regenerated with `writes=false`, `ok=true`, `complete=false`, schema gate ready, data gate not ready, media source gate ready, and deploy gate not ready.
- `git diff --check` passed.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, then rerun DB-backed no-write seven reconciliation.

## 2026-06-13 - Goal 10 Data Apply Rollback Contract

Status: no-write data apply/rollback contract hardened; schema/data/media-copy/deploy gates remain owner-approval blocked.

Changed:

- Fixed the write-gated seven importer rollback call so `write_rollback_sql` receives `language_rows` and `include_languages` consistently with its current signature. The bug would have stopped a future approved apply before writes, because rollback SQL is generated before DB connection/write.
- Added `content-service/scripts/check-seven-data-apply-contract.py` to statically verify apply gates, rollback scope, language include handling, idempotent upsert conflict keys, transaction commit/rollback behavior, and v20 dry-run counts.
- Extended `content-service/scripts/check-seven-apply-readiness.py` with `--data-apply-contract-report`; data approval readiness now requires the no-write apply/rollback contract report in addition to post-schema target reconciliation.

Verification:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py content-service/scripts/check-seven-data-apply-contract.py content-service/scripts/check-seven-apply-readiness.py` passed.
- `/tmp/speakasap-seven-data-apply-contract-v2.json` recorded `writes=false`, `ok=true`, dry-run blockers empty, payload counts match `19/19/136/429`, rollback signature includes language scope, execute-apply signature includes language scope, and required write-gate/rollback/upsert snippets present.
- `/tmp/speakasap-seven-apply-readiness-v6.json` recorded `writes=false`, `ok=true`, `complete=false`, `dataApplyContractReady=true`, `readyForOwnerSchemaApproval=true`, and `readyForOwnerDataApproval=false` because target post-schema DB reconciliation has not run.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, then rerun DB-backed no-write seven reconciliation.

## 2026-06-13 - Goal 10 Schema Migration Plan Verifier

Status: no-write schema migration scope checker added; schema/data/media-copy/deploy gates remain owner-approval blocked.

Changed:

- Added `content-service/scripts/check-seven-schema-migration-plan.py` to statically verify the content-service schema migration scope before owner approval.
- The checker validates that the base init migration creates the expected empty content tables, the seven migration creates `SevenCourse`, `SevenLesson`, and `SevenExercise`, required indexes/FKs exist, destructive DDL/DML statements are absent, and the Prisma schema contains the required seven models/relations.
- Extended `content-service/scripts/check-seven-apply-readiness.py` with `--schema-migration-plan-report`; schema approval readiness now requires this report to be present, no-write, ok, and to preserve the owner-approval boundary.

Verification:

- `cd content-service && npm run prisma:validate` passed.
- `python3 -m py_compile content-service/scripts/check-seven-schema-migration-plan.py content-service/scripts/check-seven-apply-readiness.py` passed.
- `/tmp/speakasap-seven-schema-migration-plan-v2.json` recorded `writes=false`, `ok=true`, expected migrations present, expected migration scopes ok, schema models present, and schema relations present.
- `/tmp/speakasap-seven-apply-readiness-v5.json` recorded `writes=false`, `ok=true`, `complete=false`, `schemaMigrationPlanReady=true`, `readyForOwnerSchemaApproval=true`, and `readyForOwnerDataApproval=false`.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, then rerun DB-backed no-write seven reconciliation.

## 2026-06-13 - Goal 10 Media Source Readiness Gate

Status: no-write readiness checker extended with media source/copy-manifest gate; schema/data/media-copy/deploy gates remain owner-approval blocked.

Changed:

- Extended `content-service/scripts/check-seven-apply-readiness.py` with optional `--media-availability-report` and `--media-copy-manifest-report` inputs.
- Added a separate `mediaSource` gate requiring no-write availability evidence, `missing=0`, no-write copy manifest evidence, `missingRefs=0`, and availability/manifest count consistency before media approval can be considered ready.
- Updated cutover readiness so production cutover requires data readiness, media source readiness, and deployment smoke success.

Verification:

- `python3 -m py_compile content-service/scripts/check-seven-apply-readiness.py` passed.
- `/tmp/speakasap-seven-apply-readiness-v4.json` recorded `writes=false`, `ok=true`, `complete=false`, schema gate ready, data gate not ready, deploy gate not ready, and `mediaSource.readyForOwnerMediaApproval=true`.
- Media source gate evidence in v4: availability checked `1212`, availability missing `0`, manifest total refs `1212`, manifest available refs `1212`, manifest missing refs `0`, and availability covers manifest `true`.

Boundary:

- No database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, then rerun DB-backed no-write seven reconciliation.

## 2026-06-13 - Goal 10 Seven Audio Material-Language Fix

Status: no-write importer/media readiness fix completed; schema/data/media-copy/deploy gates remain owner-approval blocked.

Changed:

- Updated `content-service/scripts/migrate-seven-from-legacy.py` so rendered legacy `{% audio ... ml='fr' %}` tags use the explicit material/audio language code instead of always using the course language code.
- Added `content-service/scripts/check-seven-missing-media-sources.py`, a no-write HEAD-only resolver for missing media source alternatives.
- Extended `content-service/scripts/prepare-seven-media-manifest.py` so future manifests can record resolver-based source overrides, though the corrected v20 dry-run no longer needs overrides for the Russian/French course audio.

Evidence:

- Sub-agent read-only investigation found the previous 28 missing refs came from legacy `fr/russian` templates for course id 19, where audio tags explicitly pass `ml='fr'`.
- `/tmp/speakasap-seven-ru-audio-source-alternatives-v1.json` verified all 28 `/media/audio/fr/...` alternatives return HTTP 200.
- `/tmp/speakasap-seven-dry-run-v20.json` recorded `writes=false`, no blocking issues, payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, `htmlSafety.ok=true`, and media refs `audio=1076`, `pdf=136`, `video=133`.
- `/tmp/speakasap-seven-media-check-legacy-source-v2.json` checked all `1212` internal refs from v20 against `https://speakasap.com` and returned `1212` ok, `0` missing.
- `/tmp/speakasap-seven-media-copy-manifest-v3.json` recorded `availableRefs=1212`, `missingRefs=0`, audio bytes `3229902938`, and PDF bytes `11240877`.
- `/tmp/speakasap-seven-assets-contract-v2.json` passed for the v20 media refs and `https://assets.alfares.cz`.
- `/tmp/speakasap-seven-apply-readiness-v3.json` recorded `ok=true`, `complete=false`, schema gate ready, data gate not ready, and expected media counts `audio=1076`, `pdf=136`, `video=133`.

Boundary:

- No media was downloaded or copied.
- No object storage, public route, target database schema/data, image build/push, Kubernetes rollout, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, then rerun DB-backed no-write seven reconciliation.

## 2026-06-13 - Goal 10 Typography Preservation Contract

Status: no-write frontend typography contract checker added; schema/data/media/deploy gates remain owner-approval blocked.

Changed:

- Added `scripts/check-seven-typography-contract.py` to verify preservation of the legacy seven-course text style in the new frontend implementation.
- The checker validates the self-hosted `PT Mono` and `Open Sans` font files, critical `.seven-page`, `.hyphenate`, `.lesson__content`, `.lesson__content--seven`, heading, table, app-promo, and desktop reading-size CSS declarations, plus route markers for course/lesson pages, reading indicator, PDF link, and legacy lesson content wrapper.

Verification:

- `python3 -m py_compile scripts/check-seven-typography-contract.py` passed.
- `/tmp/speakasap-seven-typography-contract-v2.json` recorded `writes=false`, `ok=true`, `cssFileExists=true`, `fontFilesExist=true`, `cssContractOk=true`, and `requiredSnippetsOk=true`.
- `git diff --check` passed after the checker and docs update.

Boundary:

- No database connection, content DB schema migration, seven data apply, media copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, then rerun DB-backed no-write seven reconciliation.

## 2026-06-13 - Goal 10 Readiness Approval Consistency Gate

Status: no-write readiness checker hardened; schema/data/media/deploy gates remain owner-approval blocked.

Changed:

- Extended `content-service/scripts/check-seven-apply-readiness.py` to validate approval-packet consistency.
- The checker now requires the active schema approval text to live in `CONTENT_BASE_SCHEMA_APPROVAL.md`, verifies `SEVEN_SCHEMA_MIGRATION_APPROVAL.md` is marked superseded when present, and fails schema readiness if stale seven-only schema approval wording reappears in active approval docs.

Verification:

- `python3 -m py_compile content-service/scripts/check-seven-apply-readiness.py` passed.
- `/tmp/speakasap-seven-apply-readiness-v2.json` recorded `writes=false`, `ok=true`, `complete=false`, `approvalDocsConsistent=true`, `activeSchemaApprovalTextPresent=true`, `supersededSchemaDocMarked=true`, `staleActiveSchemaPhrasesAbsent=true`, `readyForOwnerSchemaApproval=true`, and `readyForOwnerDataApproval=false`.

Boundaries:

- No database connection, content DB schema migration, seven data apply, media copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service Prisma migrations, then rerun DB-backed no-write seven reconciliation.

## 2026-06-13 - Goal 10 Intent Preservation Evidence Restored

Status: no-write documentation update completed; schema/data/media/deploy gates remain owner-approval blocked.

Changed:

- Restored `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md` as the migration governance source required by AGENTS.md.
- Added `docs/orchestrator/SEVEN_INTENT_PRESERVATION_EVIDENCE.md` for the seven-lesson course slice.
- Recorded legacy evidence, ownership boundaries, style-preservation requirements, no-write reports, approval status, rollback expectations, and commit-message evidence block.

Evidence:

- Seven dry-run remains `/tmp/speakasap-seven-dry-run-v19.json`: `writes=false`, no blocking issues, 19 languages, 19 courses, 136 lessons, 429 exercises, HTML safety ok.
- Asset contract remains `/tmp/speakasap-seven-assets-contract-v1.json`: ok for 1373 refs.
- Apply readiness remains `/tmp/speakasap-seven-apply-readiness-v1.json`: ready only for owner schema approval; data apply and cutover are not ready.

Boundaries:

- No content DB schema migration was applied.
- No seven data apply, media copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Get explicit schema-only owner approval, apply pending content-service Prisma migrations to the Kubernetes content database, then rerun DB-backed no-write seven reconciliation.

## 2026-06-13 - Salary Lesson UUID Backfill Apply

Status: applied and post-apply verified.

Approval:

- Owner approved the write in chat on 2026-06-13: apply the exact write-gated scope to update only imported `salary_expenses.lesson_uuid` using `--apply --lesson-uuid-backfill-only`, with rollback SQL and apply JSON report under `/tmp`.

Apply evidence:

- Temporary `kubectl -n statex-apps port-forward svc/db-server-postgres 15434:5432` on `alfares` was opened for the apply and post-apply verification, then stopped.
- Approved apply command wrote `/tmp/speakasap-salary-lesson-uuid-backfill-rollback-v1.sql` and `/tmp/speakasap-salary-lesson-uuid-backfill-apply-v1.json`.
- The initial row-by-row apply was interrupted after partial progress because it was too slow; it had already filled `1237` imported lesson salary expense UUIDs by the time the optimized rerun started.
- `salary-service/scripts/migrate-salary-data.ts` was hardened to use batched set-based `UPDATE ... FROM (VALUES ...)` for the same scoped backfill.
- Optimized apply completed with `lessonUuidBackfilled=97516`, `candidates=97516`, `missingTargetLessonUuids=0`; total filled after both passes is `98753` imported lesson salary expenses.

Verification:

- `cd salary-service && npm run build` passed after the set-based update hardening.
- Post-apply no-write report `/tmp/speakasap-salary-lesson-uuid-backfill-post-apply-v1.json` recorded `writes=false`, `dryRun=true`, imported lesson expenses existing `98753`, imported lesson expenses with null lesson UUID `0`, with lesson UUID `98753`, would update `0`, and missing target lesson UUIDs `0`.

Boundary:

- Write scope was limited to imported salary lesson expense `lesson_uuid` fields in `salary_expenses`.
- No salary profile, employee contract, calculation run, payout run, payment/disbursement, education row, user row, legacy row, deployment, destructive operation, or legacy retirement was run.
- Rollback SQL is `/tmp/speakasap-salary-lesson-uuid-backfill-rollback-v1.sql`.

Next:

- Continue salary parity by comparing education aggregate totals against legacy recording-duration cases before enabling salary calculation runs or payout flows.

## 2026-06-13 - Salary Lesson UUID Backfill Dry-Run Evidence

Status: no-write dry-run completed; apply remains owner-approval gated.

Evidence:

- Temporary `kubectl -n statex-apps port-forward svc/db-server-postgres 15434:5432` on `alfares` restored target DB connectivity for the report, then the port-forward was stopped.
- Dry-run command: `cd salary-service && npm run migrate:salary-data -- --dry-run --lesson-uuid-backfill-only --json-report /tmp/speakasap-salary-lesson-uuid-backfill-dry-run-v1.json` with legacy, salary, user, and education DB URLs routed through `127.0.0.1:15434`.
- Report `/tmp/speakasap-salary-lesson-uuid-backfill-dry-run-v1.json` recorded `writes=false` and `dryRun=true`.
- Lesson UUID backfill report: source lesson salary mappings `99820`; verified in target education `99820`; missing target lesson UUIDs `0`; imported lesson expenses existing `98753`; imported lesson expenses with null lesson UUID `98753`; would update imported lesson expenses `98753`; future import payload lesson UUID count `98753`.
- Related mapping counts: salary profiles missing auth UUID `0`; salary expenses skipped without profile remain `1338`, matching the known migration orphan policy.

Boundary:

- No salary, education, user, payment, payout, calculation, contract, or legacy data write was run.
- No deployment or destructive operation ran.
- Apply remains blocked until explicit owner approval names the backfill apply scope and rollback SQL path.

Next:

- If owner approves, run `--apply --lesson-uuid-backfill-only --confirm-write --approval-note ... --rollback-plan /tmp/speakasap-salary-lesson-uuid-backfill-rollback-v1.sql --json-report /tmp/speakasap-salary-lesson-uuid-backfill-apply-v1.json`, then rerun the dry-run/status check to verify `lesson_uuid` null count is cleared for imported lesson expenses.

## 2026-06-13 - Salary Lesson UUID Backfill Implementation

Status: code implementation complete; DB-backed backfill report blocked by target DB connectivity; no salary writes ran.

Changed:

- Enhanced `salary-service/scripts/migrate-salary-data.ts` with `--lesson-uuid-backfill-only` mode.
- The migration now derives imported lesson salary expense mappings from the existing joined `education_lessonsalaryexpense.lesson_id` data and can populate `SalaryExpense.lessonUuid` for future full imports.
- Added dry-run report fields for lesson UUID backfill: source mappings, education verification status, missing target lesson UUID samples, imported lesson rows with/without UUIDs, and candidate update samples.
- Added write-gated apply behavior that updates only existing imported `salary_expenses.lesson_uuid` rows when `--apply --lesson-uuid-backfill-only --confirm-write --approval-note ... --rollback-plan ...` is supplied.
- Added rollback SQL generation for the lesson UUID backfill-only mode.
- Updated `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` to mark code support present and keep DB-backed report/apply as the next gated step.

Evidence:

- RAG lookup from the local session failed with curl exit code `6`, so repository and remote evidence were used.
- Reviewed remote salary migration code and schema in `/home/ssf/Documents/Github/speakasap/salary-service` and education lesson schema in `education-service/prisma/schema.prisma`.
- `cd salary-service && npm run build` passed after the change.
- `cd salary-service && npm run migrate:salary-data -- --help` shows `--lesson-uuid-backfill-only` dry-run and apply commands.
- `cd salary-service && npm run migrate:salary-data -- --apply --lesson-uuid-backfill-only --confirm-write --approval-note test` refused before any DB write because `--rollback-plan` was absent.
- DB-backed dry-run attempts were no-write but blocked before report creation: with all DB URLs rewritten to `127.0.0.1:15434`, education verification failed with `ECONNREFUSED`; without rewriting `EDUCATION_DATABASE_URL`, cluster DNS failed with `EAI_AGAIN db-server-postgres`. `ss -ltn | grep 15434` showed no active listener on `alfares`.

Boundaries:

- No salary profile, salary expense, employee contract, calculation run, payout run, payment, education, or legacy data write was run.
- No payout/disbursement, deployment, destructive action, or legacy retirement ran.
- Existing unrelated remote worktree changes were preserved and not reverted.

Next:

- Restore target salary/education DB connectivity on `alfares`, run the no-write `--dry-run --lesson-uuid-backfill-only --json-report /tmp/speakasap-salary-lesson-uuid-backfill-dry-run-v1.json`, then request explicit owner approval before any backfill apply.


## 2026-06-13 - Goal 10 Seven Write-Gated Apply Path

Status: apply path implemented and verified in no-write mode; no schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Extended `content-service/scripts/migrate-seven-from-legacy.py` from dry-run-only to a write-gated importer.
- Apply mode now requires `--apply --confirm-write --approval-note ... --rollback-plan ...`.
- Apply mode generates rollback SQL before writes and refuses to run when dry-run blocking issues exist.
- Added static rendering for common legacy Django tags: `title`, `audio`, `video`, `url`, `load`, and `hg/endhg`, so migrated HTML is closer to legacy learner-visible output and does not expose common template syntax.

Verification:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `content-service/scripts/migrate-seven-from-legacy.py --help` showed the write gates.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` refused before any connection/write with `ERROR: --apply requires --confirm-write` and exit status `2`.
- `/tmp/speakasap-seven-dry-run-v2.json` recorded `writes=false`, `applySupported=true`, source counts `sevenCourses=19`, `sevenLessons=136`, and migration payload `courses=19`, `lessons=136`, `exercises=429`.
- `/tmp/speakasap-seven-dry-run-target-v5.json` used the runtime `speakasap-content-secret` database URL through a temporary port-forward and recorded `writes=false`, target checked, no blocking issues, and target `SevenCourse`, `SevenLesson`, and `SevenExercise` tables missing before schema migration.

Boundaries:

- No content-service schema migration was applied.
- No seven content data was written.
- No frontend/content/gateway deployment was run.
- No legacy route was retired.
- Legacy `speakasap-portal` remains the behavior/style reference and fallback.

Next:

- Get owner approval to apply only `content-service/prisma/migrations/20260613110000_seven_content/migration.sql`, then rerun the DB-backed no-write seven report before any data apply approval is considered.


## 2026-06-13 - Goal 10 Seven Schema/API, Dry-Run Importer, And Frontend Routes

Status: partial implementation complete; no DB write, deployment, object mutation, destructive operation, or legacy route retirement ran.

Changed:

- Added content-service Prisma models `SevenCourse`, `SevenLesson`, and `SevenExercise`, plus migration SQL `content-service/prisma/migrations/20260613110000_seven_content/migration.sql`.
- Added content-service `seven` module with public read endpoints for courses, lessons, and lesson details.
- Added api-gateway upstream route `/api/v1/seven -> CONTENT_SERVICE_URL`.
- Added a narrow anonymous gateway exception for `GET /api/v1/seven...`; non-GET API requests still require bearer auth.
- Added `content-service/scripts/migrate-seven-from-legacy.py`, a dry-run-first inventory/reconciliation report; apply mode is intentionally blocked.
- Added frontend public routes `/<languageCode>/seven` and `/<languageCode>/seven/<order>`, gateway-only data loading in `frontend/lib/seven.ts`, and legacy typography CSS/font assets for `PT Mono` and `Open Sans`.

Verification:

- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- `cd api-gateway && npm run build` passed.
- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `cd frontend && npm run build` passed; Next listed dynamic routes `/(languageCode)/seven` and `/(languageCode)/seven/[order]`.

Dry-run evidence:

- `/tmp/speakasap-seven-dry-run-v1.json`: `writes=false`, `sevenCourses=19`, `sevenLessons=136`, no blocking issues.
- `/tmp/speakasap-seven-dry-run-target-v4.json`: used the runtime `speakasap-content-secret` database URL through temporary port-forward; `writes=false`, `sevenCourses=19`, `sevenLessons=136`, no blocking issues, `warnings=4`, and target `SevenCourse`, `SevenLesson`, and `SevenExercise` tables do not exist yet.
- Template inventory from the report: `lessonRowsWithExistingTemplate=136`, `exerciseHtmlFiles=429`, `answerHtmlFiles=428`, `missingLessonTemplates=0`.
- Expected warnings include non-7 row courses: English `8`, German `8`, Chinese `8`, plus missing media root in the checkout. This confirms the importer must not truncate all languages to exactly seven DB rows.

Intent / ownership:

- Public seven-course content is owned by `content-service`; frontend calls through `api-gateway`.
- `course-service` remains owner for paid products/offers; `education-service` remains owner for private progress/access; `seven_test` remains later assessment/certification scope.
- Legacy `speakasap-portal` remains the behavior/style reference and fallback.

Next:

- Get owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write report before any seven content data apply.


## 2026-06-13 - Goal 10 Seven-Lesson Frontend Migration Plan

Status: active planning; no DB write, deployment, object mutation, destructive operation, or legacy retirement ran.

Owner request:

- Migrate only the old `speakasap-portal` seven-lesson course frontend/content into the new `speakasap` server/platform.
- Move all data for the seven lessons to the new server/database.
- Preserve the learner-visible text style because it is intentionally readable for the audience.

Changed:

- Added `docs/orchestrator/SEVEN_LESSON_FRONTEND_MIGRATION_PLAN.md`.
- Added Goal 10 to `docs/orchestrator/GOALS.md`.
- Updated `TASKS.md`, `docs/orchestrator/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATE.json`, and root `STATE.json` to make Goal 10 active and pause Goal 9 without reverting existing salary changes.

Evidence:

- RAG was unavailable in the remote shell because `JWT_TOKEN` was not set, so this planning pass used repository evidence.
- Legacy `seven` evidence includes `seven/models.py`, `seven/urls.py`, `seven/api_views.py`, `portal/fixtures/seven.xml`, `seven/templates/seven/*`, `speakasap_site/templates/site/seven/base.html`, `speakasap_site/templates/site/seven/index.html`, `speakasap_site/static/css/speakasap.css`, `speakasap_site/static/css/site.css`, and `speakasap_site/static/scss/_seven.scss`.
- Target evidence includes `content-service/prisma/schema.prisma`, `content-service/src/grammar/*`, `frontend/app/*`, `frontend/lib/api-client.ts`, and `api-gateway/src/proxy/upstream-resolve.ts`.
- Read-only sub-agents completed legacy seven discovery and target platform discovery.

Intent / ownership:

- Public seven-course content belongs in `content-service`; frontend must call through `api-gateway`.
- `course-service` remains owner for paid products/offers, `education-service` for private progress/access, and assessment/certification for final tests.
- Legacy portal remains the behavior/style reference and fallback.

Next:

- Goal 10.1: implement the content-service seven-course schema/API contract without writing migrated data, then run build/static validation.

# SpeakASAP Orchestrator Status

## 2026-06-15 - Goal 9.6 Additional Draft Salary Calculation Run V2

Status: approved one-shot draft calculation run completed; payout/payment gates remain closed.

Approval:

- Owner approved the broader calculation packet in chat on 2026-06-15: "No, it's okay. I approve it. Go ahead."
- Approval packet: `docs/orchestrator/SALARY_BROADER_CALCULATION_ENABLEMENT_APPROVAL.md`.

Execution:

- Ran one temporary one-shot calculation command with `SALARY_CALCULATION_RUNS_ENABLED` scoped only to the command context.
- Used deployed education aggregate through temporary port-forward and target salary DB through temporary port-forward.
- Created one draft calculation run for period `2026-05` scoped to the 14 legacy portal users from the post-deploy preview.

Artifacts:

- Execution report: `/tmp/speakasap-salary-calculation-run-2026-05-v2.json`.
- Rollback SQL: `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v2.sql`.
- Post-run salary status: `/tmp/speakasap-salary-status-after-calculation-v2.json`.
- Calculation run ID: `b5d47fb3-e366-4c04-8683-37a51b3c45bf`.

Result:

- `writes=true` for the approved calculation run only.
- Status: `draft`.
- Rules version: `salary-duration-v3-imported-legacy-qty-v1`.
- Calculation lines: `14`.
- Totals: `CZK=29035`, `EUR=21858`.
- `payoutRunCount=0`.
- `paymentDisbursementCreated=false`.
- Post-run status recorded `calculationRuns=2` and `payoutRuns=0`.

Rollback:

- Rollback SQL deletes only `calculation_lines` for run `b5d47fb3-e366-4c04-8683-37a51b3c45bf` and then the matching `calculation_runs` row.
- Rollback was not executed and remains separately approval-gated.

Boundary:

- No payout run, payout commit, payment-service disbursement, persistent env change, salary expense/profile mutation, education/user/legacy row mutation, deployment, schema change, object-storage mutation, destructive operation, or legacy retirement ran.

Next:

- Review the V2 draft run. If accepted, keep it in `draft` until a separate finalize/payout/payment-boundary decision exists. Payouts and payment execution remain unapproved.

## 2026-06-15 - Goal 9.6 Broader Calculation Enablement Packet Prepared

Status: approval packet prepared; no new calculation run executed.

Changed:

- Added `docs/orchestrator/SALARY_BROADER_CALCULATION_ENABLEMENT_APPROVAL.md`.
- Packet scopes a possible second draft calculation run for `2026-05` to the post-deploy no-write evidence and the same 14 legacy portal users.
- Packet explicitly excludes persistent env changes, payouts, payment disbursement, salary expense/profile mutation, unrelated deployment, rollback execution, and destructive operations.

Evidence referenced:

- `/tmp/speakasap-salary-readiness-2026-05-postdeploy-v1.json`
- `/tmp/speakasap-salary-calculation-preview-2026-05-postdeploy-v1.json`
- `/tmp/speakasap-salary-status-postdeploy-20260615.json`

Boundary:

- No salary calculation run, payout run, payment disbursement, rollback, deployment, schema change, or data mutation was executed while preparing this packet.

Next:

- Wait for exact owner approval wording from `docs/orchestrator/SALARY_BROADER_CALCULATION_ENABLEMENT_APPROVAL.md` before creating any additional draft calculation run.

## 2026-06-15 - Goal 9.6 Scoped Education Deploy And Salary Rerun

Status: scoped education deploy completed; salary post-deploy no-write readiness and preview evidence captured; payout/payment gates remain closed.

Approval:

- Owner approved proceeding in chat on 2026-06-15: "I approve. Go ahead with planning".
- Approval packet: `docs/orchestrator/SALARY_EDUCATION_DEPLOY_APPROVAL.md`.

Execution:

- Built and pushed only `localhost:5000/speakasap-education:latest` from `education-service/Dockerfile`.
- Image digest: `localhost:5000/speakasap-education@sha256:264330e6f1dcfcc590593e5981ed1f8609ab2e020a3800ad4b9e1037c81c3fbd`.
- Applied only `k8s/services/education-service.yaml` in namespace `statex-apps`.
- Restarted and waited only for `deployment/speakasap-education`; rollout completed successfully at generation `20` with `1/1` ready replica.
- Health check inside the education pod returned `{"status":"ok"}`.

Post-deploy salary evidence:

- No-write salary readiness report `/tmp/speakasap-salary-readiness-2026-05-postdeploy-v1.json` recorded `writes=false`, rules version `salary-duration-v3-record-length-5min-tolerance`, `missingDurationCount=0`, `shortRecordCount=6`, `teacherMappingMissingCount=0`, `demoPayableLessonCount=1`, and the same six short-record blocker lessons as historical parity inputs.
- No-write calculation preview `/tmp/speakasap-salary-calculation-preview-2026-05-postdeploy-v1.json` recorded `writes=false`, `profiles=14`, `lines=14`, `linesUsingImportedLessonSalary=14`, `blockerSamples=6`, `blockerSamplesCoveredByImportedSalaryExpenses=6`, and `calculationRunCreated=false`.
- Read-only salary status `/tmp/speakasap-salary-status-postdeploy-20260615.json` recorded `calculationRuns=1` and `payoutRuns=0`; the single calculation run is the prior owner-approved draft smoke.

Open runtime config issue:

- `speakasap-education-secret` still lacks `LESSON_RECORD_MEDIA_TOKEN_SECRET` and `ExternalSecret/speakasap-education-secret` reports `SecretSyncedError: could not get secret data from provider`. This does not block the salary aggregate evidence, but it remains a private lesson-record media runtime blocker before playback/token smoke can be accepted.

Boundary:

- Did not run root `scripts/deploy.sh` or restart unrelated services.
- Did not enable broad salary calculation runs, create another calculation run, create/commit payout runs, call payment-service, execute rollback, mutate salary expenses/profiles, run destructive operations, mutate object storage, or retire legacy behavior.

Next:

- Keep `SALARY_CALCULATION_RUNS_ENABLED` and `SALARY_PAYOUT_FLOWS_ENABLED` closed for broad use. Next owner decision is whether to accept the post-deploy salary preview and request a separate approval packet for broader calculation enablement, or keep only the existing draft smoke while resolving the unrelated education ExternalSecret media-token sync issue.

## 2026-06-15 - Goal 9.6 Education Deploy Approval Recorded

Status: scoped education-service deploy/rerun gate approved; execution pending.

Approval:

- Owner approved proceeding in chat on 2026-06-15: "I approve. Go ahead with planning".
- Approval packet: `docs/orchestrator/SALARY_EDUCATION_DEPLOY_APPROVAL.md`.

Approved scope:

- Build/push only `localhost:5000/speakasap-education:latest`.
- Apply only `k8s/services/education-service.yaml`.
- Restart/status only `deployment/speakasap-education` in `statex-apps`.
- Run read-only health, salary readiness, and calculation preview checks for `2026-05`.

Boundary:

- Root all-service deploy, salary calculation enablement for broad use, payout creation/commit, payment disbursement, rollback execution, salary row mutation, destructive operations, and legacy retirement remain unapproved.

## 2026-06-14 - Goal 9 Salary Draft Review And Fixed-Tolerance Guard

Status: draft calculation smoke reviewed; broader salary enablement remains blocked pending deploy/runtime readiness.

Evidence:

- Reviewed `/tmp/speakasap-salary-calculation-run-2026-05-v1.json`: one owner-approved draft run `6576ac90-526e-47c6-8755-9631a4fb3149`, period `2026-05`, status `draft`, `lineCount=14`, rules version `salary-duration-v3-imported-legacy-qty-v1`, totals `EUR=21858` and `CZK=29035`.
- The draft report records `payoutRunCreated=false` and `paymentDisbursementCreated=false`; payout flows remain blocked by separate payment-boundary approval.
- Rollback artifact `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v1.sql` is scoped to deleting only the created calculation lines and run ID. Rollback was not executed.
- Fresh no-write readiness rerun through a temporary port-forward wrote `/tmp/speakasap-salary-readiness-2026-05-current-review.json` with `writes=false`, `missingDurationCount=0`, `shortRecordCount=0`, `teacherMappingMissingCount=0`, and no blocker samples. It still reports `salaryCalculationReady=false` because the currently deployed runtime is not the newly patched source path.
- Found and fixed a source inconsistency in `education-service/src/internal-salary/internal-salary.service.ts`: the documented fixed five-minute full-lesson tolerance was still implemented as `scheduledSeconds * 0.95`. The source now uses `scheduledSeconds - input.durationSeconds <= FULL_LESSON_TOLERANCE_SECONDS`.
- Added a guard to `education-service/scripts/verify-lesson-record-runtime-contract.js` so the old percentage-tolerance expression fails verification if it returns.

Verification:

- `cd education-service && npm run test:lesson-records` passed.
- `cd education-service && npm run build` passed.
- `cd salary-service && npm run check:salary-readiness -- --period 2026-05 --json-report /tmp/speakasap-salary-readiness-2026-05-current-review.json` passed far enough to write the no-write report via temporary port-forward, then exited nonzero because readiness is still false.
- The same checker cannot run directly inside the deployed salary pod because the deployed image does not include the `check:salary-readiness` npm script.

Boundary:

- No payout run, payment disbursement, salary payout commit, salary expense/profile mutation, rollback execution, legacy portal mutation, object mutation, deployment, or Kubernetes rollout was run.
- The code fix is not deployed; runtime readiness must be rerun after an approved deploy.

Next:

- Request owner approval for the scoped education-service deploy/rollout that carries the fixed five-minute salary duration rule, then rerun the no-write salary readiness and calculation preview before any broader calculation enablement. Keep payout flows disabled.

## 2026-06-13 - Salary Migration Apply To Kubernetes DB

Status: done; salary data stored in the existing Kubernetes-backed `speakasap_salary_db` through a temporary Postgres port-forward.

Owner approval:

- User instructed: "Use existing database on the SpikaSub, which is running on the Kubernetes, and use the SpikaSub database to store it." This was treated as approval to apply salary migration data to the existing SpeakASAP Kubernetes salary database after a clean no-write report.

Commands and reports:

- Temporary DB path: `kubectl -n statex-apps port-forward svc/db-server-postgres 15434:5432` on `alfares`.
- Pre-apply no-write report: `/tmp/speakasap-salary-dry-run-k8s-v1.json`.
- Apply report: `/tmp/speakasap-salary-apply-k8s-v1.json`.
- Rollback SQL: `/tmp/speakasap-salary-rollback-k8s-v1.sql`.
- Post-apply no-write report: `/tmp/speakasap-salary-post-apply-k8s-v1.json`.

Evidence:

- Pre-apply target counts were empty: salary profiles `0`, salary expenses `0`, employee contracts `0`, calculation runs `0`, payout runs `0`.
- Pre-apply conflicts were empty for legacy profile IDs, legacy expense IDs, and legacy contract IDs.
- Apply completed with `load_complete`; no payout, deployment, or payment-service disbursement was run.
- Applied target counts from post-apply dry-run: `salary_profiles=386`, `salary_expenses=103983`, `employee_contracts=632`, `calculation_runs=0`, `payout_runs=0`.
- Legacy source counts in the report: `salaryProfiles=386`, `salaryExpenseBaseRows=105321`, `lessonSalaryExpenseRows=99820`, `supportBonusRows=179`, `employeeContracts=632`, `expensesUserWithoutProfile=1338`, `lessonExpenseMissingLesson=0`, `courseSingleLessonSalaryRows=24152`, `courseGroupLessonSalaryRows=1250`.
- Expected skips/gaps remain: `1338` salary expenses without a salary profile were not imported; `SalaryProfile.authUserId` remains null for imported profiles; lesson salary rows keep `lessonUuid` null until education-service backfill/aggregate parity is completed.

Validation:

- Post-apply dry-run completed with `writes=false`.
- Post-apply conflicts now list imported legacy IDs, which is expected evidence that rerun/apply would duplicate existing imported rows unless handled by idempotent skip/update logic.

Next:

- Deploy the new user-service/education-service salary aggregate endpoints when approved, then reconcile salary calculation lines against the migrated salary expenses and education aggregates before any payout run.

## 2026-06-13 - Salary Migration Implementation Hardening

Status: partial; code implemented, runtime DB-backed salary dry-run blocked by target DB reachability.

Changed:

- Added `user-service` internal `GET /api/v1/internal/teachers/legacy-user-map` to map legacy portal user IDs to legacy teacher IDs for cross-service salary aggregation.
- Added `education-service` internal `GET /api/v1/internal/salary/period-aggregates` guarded by `X-Internal-Token`.
- Added education salary aggregate module/service and wired it into `education-service/src/app.module.ts`.
- Hardened `salary-service/scripts/migrate-salary-data.ts` with `--json-report`, `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan` gates; legacy `--load` is now treated as write mode and requires the same gates.
- Copied/updated `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` in the authoritative remote checkout.

Intent and ownership:

- Preserves legacy teacher salary behavior as a gated migration path.
- `salary-service` remains salary owner; `education-service` supplies lesson aggregates; `user-service` supplies teacher identity mapping; payment execution remains outside scope and still requires owner approval through the payment boundary.
- No salary load, payout, deployment, DB write, or payment action was run.

Verification:

- `cd user-service && npm run build` passed.
- `cd education-service && npm run build` passed.
- `cd salary-service && npm run build` passed.
- `cd salary-service && npm run migrate:salary-data -- --help` passed and showed the new dry-run/apply gate usage.
- `cd salary-service && npm run migrate:salary-data -- --apply` failed before DB setup with the expected write-gate error.
- Read-only DB-backed salary dry-run command `cd salary-service && npm run migrate:salary-data -- --dry-run --json-report /tmp/speakasap-salary-dry-run-implementation-v1.json` reached the legacy DB and reported source counts, then failed when target Prisma could not reach `db-server-postgres:5432` from the remote shell.

Evidence:

- Legacy source counts observed before the target DB failure: `salaryProfiles=386`, `salaryExpenseBaseRows=105321`, `lessonSalaryExpenseRows=99820`, `supportBonusRows=179`, `employeeContracts=632`, `expensesUserWithoutProfile=1338`, `lessonExpenseMissingLesson=0`, `courseSingleLessonSalaryRows=24152`, `courseGroupLessonSalaryRows=1250`.
- Target DB blocker: `PrismaClientInitializationError: Can't reach database server at db-server-postgres:5432`.

Next:

- Provide a reachable target salary database connection or port-forward for the remote shell, then rerun the no-write salary JSON report before any apply approval is considered.

## 2026-06-12 - Goal 1.1 Intent Preservation Pack

Status: done

Changed:

- Created SpeakASAP-local orchestrator governance modeled after the existing catalog orchestrator pack.
- Replaced the stale root growth plan with a refactoring roadmap for legacy portal migration.
- Added Goalkeeper-style owner communication rule requiring reports to end with `The next step is ...`.

Evidence:

- Remote RAG query to `docs-rag-microservice.statex-apps.svc.cluster.local:3397` failed with curl exit code 6, so repository evidence was used.
- Existing source files reviewed:
  - `/home/ssf/Documents/Github/speakasap/AGENTS.md`
  - `/home/ssf/Documents/Github/speakasap/PLAN.md`
  - `/home/ssf/Documents/Github/speakasap/BUSINESS.md`
  - `/home/ssf/Documents/Github/speakasap/SYSTEM.md`
  - `/home/ssf/Documents/Github/speakasap/TASKS.md`
  - `/home/ssf/Documents/Github/speakasap/STATE.json`
  - `/home/ssf/Documents/Github/speakasap/docs/orchestrator/STATE.json`
  - `/home/ssf/Documents/Github/speakasap-portal/AGENTS.md`
  - `/home/ssf/Documents/Github/speakasap-portal/BUSINESS.md`
  - `/home/ssf/Documents/Github/speakasap-portal/SYSTEM.md`
  - `/home/ssf/Documents/Github/speakasap-portal/TASKS.md`
  - `/home/ssf/Documents/Github/shared/.claude/memory/project_speakasap_k8s_migration.md`
  - `/home/ssf/Documents/Github/catalog-microservice/docs/orchestrator/*`

Notes:

- `speakasap/TASKS.md` references historical `docs/refactoring/*` and `docs/agents/*` artifacts, but those directories currently contain no files in this checkout.
- `speakasap-portal/SYSTEM.md` says K8s migration was permanently excluded. The owner instruction from 2026-06-12 supersedes that for this refactor workstream, but compatibility constraints remain: no unapproved Python/Django/React/Webpack upgrade and no production behavior change without a goal and evidence.

Next:

- Goal 1.2: confirm repository inventory and authoritative migration boundaries for `speakasap` and `speakasap-portal`.

## 2026-06-12 - Goal 1.2 And 1.3 Repository Inventory / Evidence Index

Status: done

Changed:

- Confirmed `/home/ssf/Documents/Github/speakasap` as the new implementation and Kubernetes deployment repo.
- Confirmed `/home/ssf/Documents/Github/speakasap-portal` as the legacy Django behavior-reference repo.
- Added `docs/orchestrator/MIGRATION_EVIDENCE.md` with current repository boundaries, source evidence, conflicts, gaps, and first Goal 2 inventory targets.
- Marked Goal 1.2 and 1.3 complete in `GOALS.md`.

Evidence:

- `speakasap` branch: `main`; HEAD `a390a5f docs: Update CLAUDE.md to reflect service name change in curl command`.
- `speakasap-portal` branch: `main`; HEAD `1076474e8 Update AGENTS.md and CLAUDE.md for deployment readiness`.
- Legacy portal inventory found many Django app domains plus `manage.py`, `portal/settings.py`, `portal/urls.py`, `requirements.txt`, `package.json`, `webpack.config.js`, and `scripts/deploy.sh`.
- New platform inventory found service package manifests, Prisma migrations, migration scripts, `api-gateway/src/proxy/*`, `frontend/lib/gateway.ts`, and K8s manifests.

Next:

- Goal 1.4: choose the first narrow migration target for owner approval, using the Goal 2 inventory targets as input.

## 2026-06-12 - Goal 1.4 First Migration Target

Status: done

Changed:

- Selected the first executable migration target: lesson workflow recordings.
- Added `docs/orchestrator/FIRST_MIGRATION_TARGET.md` with target owner, service, gateway, auth, data, storage, notification, rollback, acceptance, and verification boundaries.
- Marked Goal 1.4 complete and moved Goal 2 to active.

Evidence:

- Owner continuation request on the active goal was treated as approval to proceed with the recommended target from the prior report.
- The target was selected because legacy docs explicitly identify lesson recordings as private and MinIO-backed, and the workflow spans education data, teacher/student access, storage, merge jobs, playback, and notification.

Next:

- Goal 2.1: inventory lesson recording parity in the legacy portal and compare against the new platform.

## 2026-06-12 - Goal 2.1 Lesson Recording Workflow Inventory

Status: done

Changed:

- Added `docs/orchestrator/LESSON_RECORDING_INVENTORY.md`.
- Recorded legacy data model, teacher upload/presign/commit routes, student/teacher playback routes, tokenized playback, S3/MinIO storage rules, merge job behavior, notification behavior, DRF API surface, tests, and new-platform gaps.
- Marked the selected lesson-recording inventory chunk complete under Goal 2.

Evidence:

- Reviewed legacy files:
  - `/home/ssf/Documents/Github/speakasap-portal/education/lesson_records/models.py`
  - `/home/ssf/Documents/Github/speakasap-portal/cabinet/teacher/urls.py`
  - `/home/ssf/Documents/Github/speakasap-portal/cabinet/teacher/views/lessons.py`
  - `/home/ssf/Documents/Github/speakasap-portal/cabinet/student/urls.py`
  - `/home/ssf/Documents/Github/speakasap-portal/cabinet/record_playback.py`
  - `/home/ssf/Documents/Github/speakasap-portal/cabinet/views.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/tasks.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/api/teacher/urls.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/api/teacher/serializers/records.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/api/teacher/views/records.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/signals/handlers.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/lesson_records/tests/test_lesson_records.py`
  - `/home/ssf/Documents/Github/speakasap-portal/portal/utils/common.py`
  - `/home/ssf/Documents/Github/speakasap-portal/portal/utils/records_storage.py`
- Reviewed new platform files:
  - `/home/ssf/Documents/Github/speakasap/education-service/prisma/schema.prisma`
  - `/home/ssf/Documents/Github/speakasap/education-service/scripts/migrate-education-from-legacy.py`
  - `/home/ssf/Documents/Github/speakasap/education-service/src/app.module.ts`
  - `/home/ssf/Documents/Github/speakasap/api-gateway/src/proxy/gateway-proxy.controller.ts`
  - `/home/ssf/Documents/Github/speakasap/frontend/lib/gateway.ts`
- Repository search found no current new-platform implementation for lesson-record metadata, recording presign, recording commit, playback, MinIO/S3 adapter, or merge worker in the searched services.

Next:

- Goal 2.2: inventory the remaining legacy portal surfaces and produce the broader parity matrix.

## 2026-06-12 - Goal 2.2 Portal Surface Inventory And Parity Matrix

Status: done

Changed:

- Added `docs/orchestrator/PORTAL_SURFACE_INVENTORY.md`.
- Classified legacy runtime/deploy, URL modules, Celery task files, management commands, templates/static/assets/locales, React source, roles/workflows, domain surfaces, and current backlog risks.
- Marked Goal 2 complete and moved active state to Goal 3.
- Updated root `PLAN.md` active goal to Goal 2 completion / Goal 3 preparation.

Evidence:

- Legacy URL modules found for `administrator`, `big_brother`, `books`, `delivery`, `employees`, `helpdesk`, `investors`, `language_tests`, `marathon`, `notifications`, `offers`, `orders`, `portal`, `products`, `redirecter`, `rest`, `ses`, `seven`, `seven_test`, `speakasap_site`, and `user_quest`.
- Legacy task files found for `actions`, `administrator`, `big_brother`, `course_parser`, `courses`, `delivery`, `discount`, `education`, `education_certificates`, `employees`, `expenses`, `helpdesk`, `marathon`, `notifications`, `offers`, `orders`, `portal`, `seven`, `seven_test`, and `user_tests`.
- Management commands, template/static/asset/locale directories, React source directories, root URL includes, and new platform service folders were inventoried.
- Legacy backlog risks ISSUE-106 through ISSUE-109 were carried forward because they affect notification and recording merge verification.

Next:

- Goal 3.1: define the lesson recording service/gateway/auth/storage/notification contract before implementation code changes.

## 2026-06-12 - Goal 3.1 Lesson Recording Service Contract

Status: done

Changed:

- Added `docs/orchestrator/LESSON_RECORDING_CONTRACT.md`.
- Defined target `education-service` data model, route contract, auth/RBAC checks, storage requirements, merge behavior, notification contract, gateway requirements, frontend expectations, and verification commands.
- Marked Goal 3.1 complete while keeping Goal 3 active for the remaining gateway/refactor artifact reconstruction and broader route mapping.

Evidence:

- `education-service/src/main.ts` confirms global prefix `api/v1`, so gateway routes under `/api/v1/lessons/:lessonUuid/record...` align with service routing.
- `api-gateway/src/proxy/upstream-resolve.ts` already maps `/api/v1/lessons` to `EDUCATION_SERVICE_URL`.
- `education-service/src/lessons/*` shows current lesson endpoints are staff-only and need teacher/student-specific access helpers for recording parity.
- `education-service/prisma/schema.prisma` currently has no `LessonRecord` or `LessonRecordPart`.
- `api-gateway/src/proxy/gateway-auth.guard.ts` confirms bearer validation is centralized at gateway and must be preserved.

Next:

- Goal 3.2: recreate the missing gateway ownership/API contract artifacts referenced by `TASKS.md`, linking the lesson-recording contract to current `api-gateway` upstream routing.

## 2026-06-12 - Goal 3.2 Gateway Ownership/API/Auth Artifacts

Status: done

Changed:

- Recreated `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`.
- Recreated `docs/refactoring/GATEWAY_API_CONTRACT.md`.
- Recreated `docs/refactoring/GATEWAY_AUTH_BOUNDARY.md`.
- Linked lesson-recording routes to the existing `/api/v1/lessons` gateway ownership.
- Marked Goal 3.2 complete and advanced state to Goal 3.3.

Evidence:

- `api-gateway/src/proxy/upstream-resolve.ts` is the route ownership source of truth and already comments that it aligns with `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`.
- `README.md` links `docs/refactoring/GATEWAY_API_CONTRACT.md`.
- `TASKS.md` records that the original gateway route ownership matrix, gateway API contract, and auth boundary had existed historically, but the files were absent from the current checkout.
- The recreated docs preserve current gateway behavior and add the first migration target route contract under `/api/v1/lessons/:lessonUuid/record...`.

Next:

- Goal 3.3: map remaining legacy portal workflows to owner services and gateway route groups.

## 2026-06-12 - Goal 3.3 And 3.4 Workflow Ownership / Auth Matrix

Status: done

Changed:

- Added `docs/orchestrator/WORKFLOW_OWNERSHIP_MAP.md`.
- Added `docs/orchestrator/AUTH_RBAC_MATRIX.md`.
- Marked Goal 3.3 and Goal 3.4 complete.
- Advanced state to Goal 4.1: lesson recording migration design.

Evidence:

- Workflow ownership map uses Goal 2 portal surface inventory and current gateway route ownership as inputs.
- Auth/RBAC matrix preserves the boundary that `auth-microservice` owns identity while SpeakASAP services enforce domain access.
- High-risk gates are explicitly carried forward for payments, private recordings, student data, salary/finance, auth, and destructive migration.

Next:

- Goal 4.1: design the lesson-recording dry-run/reconciliation migration before any schema or runtime code changes.

## 2026-06-12 - Goal 4.1 Lesson Recording Migration Design

Status: done

Changed:

- Added `docs/orchestrator/LESSON_RECORDING_MIGRATION_DESIGN.md`.
- Marked Goal 3 complete and Goal 4 active.
- Split Goal 4 into dry-run-first chunks, starting with lesson-recording migration.
- Updated root `PLAN.md` and `STATE.json` to point to Goal 4.2.

Evidence:

- Legacy migrations show current lesson-record shape evolved from initial `ready/order/FK` model to JSONB `parts` with `processed` and `record_unavailable`.
- Legacy management commands show existing DB-only key normalization for `courses/records/YYYY/MM/DD/...` to `YYYY/MM/DD/...`.
- Current `education-service` migration script imports education core tables but not lesson records.
- Current target Prisma migration has no lesson-record tables yet.

Next:

- Goal 4.2: add `education-service/scripts/migrate-lesson-records-from-legacy.py` as a dry-run/reporting script only.

## 2026-06-12 - Goal 4.2 Lesson Recording Dry-Run Script

Status: done

Changed:

- Added `education-service/scripts/migrate-lesson-records-from-legacy.py`.
- Script is read-only and refuses to run unless `--dry-run` is supplied.
- Supports `--check-target`, `--limit`, and `--json-report`.
- Reports source counts, state classification, key classification, missing target lessons, missing/orphan parts, duplicate records, and exact IDs for conflicts.
- Marked Goal 4.2 complete and advanced state to Goal 4.3.

Evidence:

- Script follows `LESSON_RECORDING_MIGRATION_DESIGN.md`.
- No write mode, truncation, legacy DB write, target DB write, or object deletion exists in the script.
- `python3 -m py_compile education-service/scripts/migrate-lesson-records-from-legacy.py` passed.
- `python3 education-service/scripts/migrate-lesson-records-from-legacy.py --help` printed the expected CLI options.
- Running without `--dry-run` returned code 2 and refused to run.
- Running with `--dry-run` but without `EDUCATION_SOURCE_DATABASE_URL` / `SOURCE_DATABASE_URL` returned code 1 and failed before opening any DB connection.

Next:

- Goal 4.3: inventory remaining migration scripts and Prisma schemas for dry-run/reconciliation safety gaps.

## 2026-06-12 - Goal 4.3 Remaining Migration Script Inventory

Status: done

Changed:

- Added `docs/orchestrator/MIGRATION_SCRIPT_INVENTORY.md`.
- Inventoried existing migration scripts and Prisma schemas across the service repo.
- Classified dry-run quality, write safety, destructive flags, idempotency posture, and next priority.
- Marked Goal 4.3 complete and advanced state to Goal 4.4.

Evidence:

- Migration scripts found in `assessment-service`, `certification-service`, `course-service`, `education-service`, `financial-service`, `notification-service`, `payment-service`, `salary-service`, and `user-service`.
- Prisma schemas found in `assessment-service`, `certification-service`, `content-service`, `course-service`, `education-service`, `financial-service`, `notification-service`, `payment-service`, `salary-service`, and `user-service`.
- `content-service` has schema/migration coverage but no legacy migration script was found.
- Older Python scripts in `course-service` and `education-service` expose `--truncate-first` and use plain insert copy helpers, so they are not safe rerun targets without hardening.
- `assessment-service`, `certification-service`, and `user-service` have dry-run and upsert behavior, but still expose `--truncate-first` and need stronger source-to-target conflict reports.
- TypeScript scripts in `financial-service`, `notification-service`, `payment-service`, and `salary-service` require explicit `--load` and mostly use upserts or deterministic IDs with `skipDuplicates`; payment remains high business risk and notification has scoped link replacement via `deleteMany`.
- The new lesson-record dry-run script remains the safest current migration artifact because it has no write mode.

Next:

- Goal 4.4: define source-to-target mappings, starting with `education-service`, `user-service`, and `course-service` because lesson-recording reconciliation depends on target lessons and participant role data.

## 2026-06-12 - Goal 4.4 Source-To-Target Mapping

Status: done

Changed:

- Added `docs/orchestrator/SOURCE_TARGET_MAPPING.md`.
- Mapped education, user, course, assessment, certification, content, payment, notification, salary, and financial source tables to target Prisma models.
- Identified identifier strategy, required joins, orphan handling, and reconciliation checks.
- Prioritized the Goal 4.5 implementation order: education, user, course, then lesson-record target checks.
- Marked Goal 4.4 complete and advanced state to Goal 4.5.

Evidence:

- Education mapping is based on `education-service/scripts/migrate-education-from-legacy.py` and `education-service/prisma/schema.prisma`.
- User mapping is based on `user-service/scripts/migrate-user-from-legacy.py` and `user-service/prisma/schema.prisma`.
- Course mapping is based on `course-service/scripts/migrate-course-from-legacy.py` and `course-service/prisma/schema.prisma`.
- Assessment, certification, payment, notification, salary, and financial mappings are based on their existing migration scripts and Prisma schemas.
- Content mapping is based on `content-service/prisma/schema.prisma` plus legacy `language`, `grammar`, `phonetics`, and `songs` model evidence; no content migration script exists yet.
- The selected lesson-recording workflow remains blocked on reliable target lesson and participant mappings before any write mode can be considered.

Next:

- Goal 4.5: harden `education-service/scripts/migrate-education-from-legacy.py` so its dry run reports source/target IDs, missing FK endpoints, duplicate keys, and conflicts without writes.

## 2026-06-12 - Goal 4.5 Education Dry-Run/Reconciliation Hardening

Status: in progress

Changed:

- Hardened `education-service/scripts/migrate-education-from-legacy.py`.
- Added `--check-target`, `--json-report`, `--limit`, and `--allow-truncate-first`.
- Replaced counts-only dry run with a reconciliation report for source counts, duplicate keys, missing FK endpoints, target counts, target key conflicts, and target pair conflicts.
- Kept dry run read-only.
- Added a pre-connection refusal for `--truncate-first` unless `--allow-truncate-first` is also supplied.

Evidence:

- `python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py` passed on the remote repo.
- `python3 education-service/scripts/migrate-education-from-legacy.py --help` shows the new dry-run/reporting flags.
- Running dry run without `EDUCATION_SOURCE_DATABASE_URL` or `SOURCE_DATABASE_URL` exits with code 1 and reports the missing source URL.
- Running `--truncate-first` with invalid source/target URLs exits with code 2 and refuses before attempting a DB connection.

Remaining for Goal 4.5:

- Harden `user-service/scripts/migrate-user-from-legacy.py` dry-run reporting for unresolved auth identities, duplicate emails, missing manager references, and teacher language replacement scope.
- Harden `course-service/scripts/migrate-course-from-legacy.py` dry-run reporting for missing FK endpoints, duplicate keys, and target conflicts.
- Re-run the lesson-record dry-run target checks after education/user/course reconciliation reports exist.

Next:

- Goal 4.5 continuation: harden `user-service/scripts/migrate-user-from-legacy.py` dry-run/reconciliation reporting.

## 2026-06-12 - Goal 4.5 User Dry-Run/Reconciliation Hardening

Status: in progress

Changed:

- Hardened `user-service/scripts/migrate-user-from-legacy.py`.
- Added `--check-target`, `--json-report`, `--limit`, and `--allow-truncate-first`.
- Replaced counts-only dry run with source reconciliation for counts, duplicate keys, missing FK endpoints, unresolved auth identities, missing manager references, and teacher language relation issues.
- Added optional target reconciliation for existing target IDs, auth UUID conflicts, target counts, and teacher language replacement scope.
- Kept dry run read-only.
- Added a pre-connection refusal for `--truncate-first` unless `--allow-truncate-first` is also supplied.

Evidence:

- `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py` passed on the remote repo.
- `python3 user-service/scripts/migrate-user-from-legacy.py --help` shows the new dry-run/reporting flags.
- Running dry run without `SOURCE_DATABASE_URL` exits with code 1 and reports the missing source URL.
- Running `--truncate-first` with invalid source/target URLs exits with code 2 and refuses before attempting a DB connection.

Remaining for Goal 4.5:

- Harden `course-service/scripts/migrate-course-from-legacy.py` dry-run reporting for missing FK endpoints, duplicate keys, and target conflicts.
- Re-run the lesson-record dry-run target checks after education/user/course reconciliation reports exist.

Next:

- Goal 4.5 continuation: harden `course-service/scripts/migrate-course-from-legacy.py` dry-run/reconciliation reporting.

## 2026-06-12 - Goal 4.5 Course Dry-Run/Reconciliation Hardening

Status: done

Changed:

- Hardened `course-service/scripts/migrate-course-from-legacy.py`.
- Added `--check-target`, `--json-report`, `--limit`, and `--allow-truncate-first`.
- Replaced counts-only dry run with source reconciliation for counts, duplicate keys, missing FK endpoints, offer/product/order relationship gaps, and teacher/student cross-service references.
- Added optional target reconciliation for existing target IDs, offer UUID conflicts, and product-part composite link conflicts.
- Kept dry run read-only.
- Added a pre-connection refusal for `--truncate-first` unless `--allow-truncate-first` is also supplied.
- Marked Goal 4.5 complete and advanced state to Goal 4.6.

Evidence:

- `python3 -m py_compile course-service/scripts/migrate-course-from-legacy.py` passed on the remote repo.
- `python3 course-service/scripts/migrate-course-from-legacy.py --help` shows the new dry-run/reporting flags.
- Running dry run without `COURSE_SOURCE_DATABASE_URL` or `SOURCE_DATABASE_URL` exits with code 1 and reports the missing source URL.
- Running `--truncate-first` with invalid source/target URLs exits with code 2 and refuses before attempting a DB connection.
- Remote shell environment does not currently contain `EDUCATION_*`, `COURSE_*`, `SOURCE_DATABASE_URL`, `TARGET_DATABASE_URL`, `AUTH_DATABASE_URL`, or `DATABASE_URL`, so DB-backed dry-run reports were not executed in this pass.

Goal 4.5 result:

- `education-service/scripts/migrate-education-from-legacy.py`, `user-service/scripts/migrate-user-from-legacy.py`, and `course-service/scripts/migrate-course-from-legacy.py` now have dry-run/reconciliation reporting before write use.
- All three scripts require an explicit second approval flag before destructive truncation.
- DB-backed dry-run output remains a cutover prerequisite when runtime database URLs are available in a safe execution environment.

Next:

- Goal 4.6: add idempotency or duplicate guards where these migrations can be rerun, starting with plain-insert education/course copy paths.

## 2026-06-12 - Goal 4.6 Idempotency / Duplicate Guards

Status: done

Changed:

- Added write-mode duplicate guards to `education-service/scripts/migrate-education-from-legacy.py`.
- Added write-mode duplicate guards to `course-service/scripts/migrate-course-from-legacy.py`.
- Both scripts now run target conflict preflight before plain-insert write mode when `--truncate-first` is not selected.
- The explicit write-mode policy is `conflict_policy=fail`: preserved target IDs and composite keys are checked before inserts, and any conflict causes the script to exit before writing rows.
- Existing owner-gated truncation remains the only path that can deliberately clear target tables before import.
- Marked Goal 4.6 complete and added Goal 4.7 for DB-backed dry-run capture.

Evidence:

- `python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py course-service/scripts/migrate-course-from-legacy.py user-service/scripts/migrate-user-from-legacy.py education-service/scripts/migrate-lesson-records-from-legacy.py` passed on the remote repo.
- `python3 education-service/scripts/migrate-education-from-legacy.py --help` and `python3 course-service/scripts/migrate-course-from-legacy.py --help` show the dry-run/reporting and truncation-approval flags.
- Running `--truncate-first` with invalid source/target URLs exits with code 2 for both education and course scripts and refuses before attempting a DB connection.
- `.env` exists and contains the required key names for education/course/source/target/auth database URLs, but the configured legacy source endpoint at `127.0.0.1:15432` refused connection during DB-backed dry-run execution.

Remaining for Goal 4:

- Capture DB-backed dry-run reports once the legacy source database endpoint is reachable.

Next:

- Goal 4.7: restore or start the legacy source DB endpoint configured at `127.0.0.1:15432`, then run read-only dry-run reports for education, user, course, and lesson-record migrations.

## 2026-06-12 - Goal 4.7 DB-Backed Dry-Run Capture

Status: done

Changed:

- Started a read-only legacy DB tunnel on `alfares`: `127.0.0.1:15432` to the legacy SpeakASAP Postgres endpoint through the `speakasap` SSH alias.
- Ran education, course, user, and lesson-record migration dry runs against the legacy source database and target Kubernetes Postgres service.
- Updated `education-service/scripts/migrate-lesson-records-from-legacy.py` so `--limit` limits emitted sample arrays only; full counts now inspect all source lesson-record rows by default.
- Added `--source-limit` as an explicit debug-only source cap and added `issueCounts` to the lesson-record JSON report.
- No source or target writes were performed.

Evidence:

- Report files on `alfares`:
  - `/tmp/speakasap-education-dry-run.json`
  - `/tmp/speakasap-course-dry-run.json`
  - `/tmp/speakasap-user-dry-run.json`
  - `/tmp/speakasap-lesson-records-dry-run.json`
- Education source counts: `education_group=21476`, `education_group_students=21655`, `education_homework=52616`, `education_lesson=182600`, `education_studentcourse=20125`.
- Education duplicate keys, missing references, target key conflicts, and target pair conflicts are all `0`; target education tables are currently empty.
- Course source counts: `offers_extralessonsoffer=994`, `offers_offer=1900`, `products_category=5`, `products_partpaymentcollection=24`, `products_partpaymentoption=71`, `products_product=238`, `products_product_part_payments=108`.
- Course duplicate keys, missing references, target key conflicts, and target pair conflicts are all `0`; target course tables are currently empty.
- User source counts: `auth_user=214230`, `students_student=214188`, `employees_teacher=380`, `employees_manager=3`, `employees_employeeprofile=8`, `employees_teacher_additional_languages=80`.
- User duplicate keys, missing references, target ID conflicts, and target auth conflicts are all `0`; target user-service tables are currently empty.
- User auth reconciliation is not ready: target auth matching indexed `22` emails, leaving `214224` legacy `auth_user` rows unresolved, plus unresolved profile references for `214182` students, `377` teachers, `6` employee profiles, and `1` manager.
- Lesson-record source counts: `source_lesson_records=101181`, `source_lesson_record_parts=58234`, `records_ready=96726`, `records_processing=1414`, `records_unavailable=2332`, `records_none=2`.
- Lesson-record issue counts: `missing_target_lessons=101181`, `parts_missing_rows=4080`, `orphan_parts=5781`, `legacy_prefix_keys_without_date=25934`, `record_key_date_mismatch=39477`.
- Lesson-record `missing_target_lessons=101181` is expected while target `education_lesson` is empty; lesson-record migration must run after education core data is loaded and reconciled.

Result:

- Goal 4.7 is complete as a dry-run evidence capture.
- Write migration remains blocked by ordering and identity prerequisites: auth identity reconciliation first, then education/course/user load sequencing, then lesson-record metadata and private media migration.

Next:

- Goal 4.8: trace the existing auth migration/bootstrap path and decide how legacy `auth_user` rows map to target auth UUIDs before any user/profile write migration.

## 2026-06-12 - Goal 4.8 Auth Identity Reconciliation

Status: done

Changed:

- Added `docs/orchestrator/AUTH_IDENTITY_RECONCILIATION.md`.
- Confirmed `auth-microservice` is a separate repo at `/home/ssf/Documents/Github/auth-microservice`, not a service folder inside the SpeakASAP repo.
- Confirmed `auth-microservice` has no existing SpeakASAP legacy auth import script.
- Recorded the decision gate that user-service write migration must wait for auth-owned bootstrap/mapping.

Evidence:

- `auth-microservice/BUSINESS.md` says password hashing is bcrypt only and AI agents must not directly write the user table.
- `auth-microservice/src/auth/auth.service.ts` rejects password login when stored password is not bcrypt format.
- Target auth `users` table currently has `22` rows, `22` emails, `17` passwords, and `0` duplicate email groups.
- Legacy `auth_user` has `214230` rows, all with email and password, and `95` duplicate lower-trimmed email groups.
- Legacy password hash families are `212415` Django PBKDF2 hashes and `1815` Django unusable-password markers.
- The Goal 4.7 user dry run indexed only `22` target auth emails and left `214224` legacy `auth_user` rows unresolved.

Decision:

- Auth bootstrap is required before user-service profile migration.
- Email-only mapping is unsafe because legacy has duplicate email groups while target auth email is unique.
- Copying legacy Django password hashes into target auth is rejected without owner approval because current auth login accepts bcrypt only.
- Recommended first cutover policy is auth-owned bootstrap with `password = NULL` plus password reset or magic-link setup.
- Alternative policy is an owner-approved auth-service code change to verify Django PBKDF2 and rehash to bcrypt on successful login.

Next:

- Goal 4.9: get owner approval for the auth bootstrap duplicate-email and password policy, then implement the approved path only inside `auth-microservice`.

## 2026-06-12 - Goal 4.9 Auth Bootstrap Owner Decision Packet

Status: in progress

Changed:

- Added `docs/orchestrator/AUTH_BOOTSTRAP_OWNER_DECISION.md`.
- Recorded the recommended policy: auth-owned legacy identity mapping plus `password = NULL` with password reset or magic-link setup.
- Kept Goal 4.9 pending because owner approval is still required before implementation or writes.

Evidence:

- Legacy duplicate lower-trimmed email groups: `95`.
- Rows in duplicate email groups: `192`.
- Largest duplicate group size: `3`.
- Active rows in duplicate groups: `190`.
- Student user references in duplicate groups: `192`.
- Teacher user references in duplicate groups: `2`.
- Staff and superuser rows in duplicate groups: `0`.

Decision Request:

- Password policy: approve `password = NULL` plus reset/magic-link setup, or require Django PBKDF2 compatibility in `auth-microservice`.
- Duplicate-email policy: approve a dedicated auth-owned mapping table, account merge, or canonical import with skipped duplicates.
- Implementation boundary: approve adding the dry-run/bootstrap path only inside `/home/ssf/Documents/Github/auth-microservice`.

Next:

- Record owner approval for the recommended auth-owned mapping and password-reset policy, then create the auth-microservice dry-run/bootstrap implementation plan.

## 2026-06-12 - Goal 4.9 Auth Bootstrap Implementation Plan

Status: in progress

Changed:

- Added `docs/orchestrator/AUTH_BOOTSTRAP_IMPLEMENTATION_PLAN.md`.
- Inspected `auth-microservice` implementation patterns without changing that repo.
- Recorded the proposed TypeORM mapping entity, dry-run script contract, apply-mode restrictions, verification sequence, and rollback boundary.

Evidence:

- `auth-microservice/package.json` uses NestJS/TypeScript with `npm run build`, `npm run test`, and TypeORM dependencies.
- `auth-microservice/shared/database/database.module.ts` registers TypeORM entities directly and uses `DB_SYNC=true` only when configured.
- Existing operational scripts include TypeScript/Nest application-context scripts such as `scripts/seed-rbac.ts`.
- No `auth-microservice` files were modified in this step.

Guardrail:

- The implementation plan does not authorize auth code changes or writes. Owner approval is still required for password policy, duplicate-email policy, and the auth-owned implementation boundary.

Next:

- Owner approval remains required before creating the auth-microservice dry-run/bootstrap implementation.

## 2026-06-12 - Thread Objective Completion Audit

Status: done

Changed:

- Added `docs/orchestrator/OBJECTIVE_COMPLETION_AUDIT.md`.
- Audited the original thread objective separately from the broader SpeakASAP refactor roadmap.

Evidence:

- Intent-preserving governance exists in root `AGENTS.md` and `docs/orchestrator/*`.
- Existing migration/refactoring evidence is indexed in `docs/orchestrator/MIGRATION_EVIDENCE.md`.
- Sequenced roadmap exists in root `PLAN.md` and `docs/orchestrator/GOALS.md`.
- Execution has progressed one chunk at a time from Goal 1.1 through active Goal 4.9, with evidence recorded in `STATUS.md`.
- No unapproved auth writes, destructive migrations, payment ownership changes, or recording privacy changes were performed.

Result:

- The setup/orchestration objective for this thread is complete.
- The broader refactor roadmap remains active at Goal 4.9 and should continue under the orchestrator pack.

Next:

- Continue the roadmap by getting owner approval for the auth bootstrap policy before any auth-microservice implementation or user/profile write migration.

## 2026-06-12 - Goal 4.9 Auth Bootstrap Dry-Run Implementation

Status: done

Changed:

- Owner approved the documented direction and continuing development.
- Added auth-owned dry-run script in `/home/ssf/Documents/Github/auth-microservice/scripts/bootstrap-speakasap-legacy-users.ts`.
- Added auth-owned mapping entity in `/home/ssf/Documents/Github/auth-microservice/src/users/entities/legacy-identity-mapping.entity.ts`.
- Registered the mapping entity in `/home/ssf/Documents/Github/auth-microservice/shared/database/database.module.ts`.
- Added `docs/orchestrator/AUTH_BOOTSTRAP_DRY_RUN_REPORT.md`.
- Marked Goal 4.9 complete and advanced active state to Goal 4.10.

Evidence:

- Safety checks passed:
  - script help prints expected usage;
  - running without `--dry-run` refuses;
  - running with `--dry-run --apply` refuses apply mode.
- `npm run build` passed in `auth-microservice`.
- Dry-run report path: `/tmp/speakasap-auth-bootstrap-dry-run.json`.
- Dry-run result:
  - `writes=false`
  - legacy users: `214230`
  - target auth users: `22`
  - existing target email matches: `6`
  - create candidates: `214032`
  - duplicate email candidates: `192`
  - blank email skips: `0`
  - planned user writes: `0`
  - planned mapping writes: `0`

Guardrail:

- No auth database writes, service restarts, deployments, or user-service write migrations were performed.

Next:

- Goal 4.10: review the auth dry-run report and implement apply mode only behind explicit write approval, confirmation flag, transaction, and rollback evidence.

## 2026-06-12 - Goal 4.10 Auth Bootstrap Apply Gate Implementation

Status: done

Changed:

- Implemented the owner-approved Django PBKDF2 password-continuity path in `auth-microservice`.
- Added legacy password verification fallback to `AuthService.login`.
- Added first-login upgrade behavior: successful legacy password login writes a bcrypt password through `UsersService.updatePassword` and clears the legacy hash from `legacy_identity_mappings`.
- Updated `legacy_identity_mappings` with `legacyPasswordHash` and `legacyPasswordMigratedAt`; the hash column is excluded from default TypeORM selects.
- Updated the auth bootstrap apply path to create duplicate-email legacy identities as separate auth users with `email = NULL`, preserving login via mapping lookup instead of merging users by shared email.
- Hardened mapping upsert idempotency so reruns do not reintroduce legacy hashes after a completed first-login upgrade.
- Applied the approved auth bootstrap migration to the auth database.
- Deployed `auth-microservice` so the runtime login path can verify legacy Django PBKDF2 hashes and upgrade them to bcrypt.
- Added `docs/orchestrator/AUTH_BOOTSTRAP_APPLY_GATE.md`.

Evidence:

- Build checks:
  - `node --check scripts/bootstrap-speakasap-legacy-users.ts` passed.
  - `npm run build` passed before apply and before deploy.
- Final no-write dry-run report before apply: `/tmp/speakasap-auth-bootstrap-dry-run-v5.json`.
- Final rollback SQL artifact before apply: `/tmp/speakasap-auth-bootstrap-rollback-v5.sql`.
- Final dry-run summary before apply:
  - `writes=false`
  - legacy users: `214230`
  - target users before apply: `22`
  - duplicate email groups: `95`
  - duplicate email rows: `192`
  - existing target email matches: `6`
  - create candidates: `214032`
  - duplicate email candidates: `192`
  - planned user writes: `214224`
  - planned mapping writes: `214230`
- Apply command used `--apply --confirm-write --approval-note "User approved legacy SpeakASAP auth bootstrap with Django PBKDF2 password continuity on 2026-06-12" --password-policy legacy-pbkdf2-upgrade`.
- Post-apply auth DB verification:
  - total auth users: `214246`
  - new `speakasap-portal` source users: `214224`
  - `speakasap-portal` source users with null primary email: `192`
  - `speakasap-portal` source users with password set in `users.password`: `0`
  - legacy mappings: `214230`
  - mappings with auth user: `214230`
  - mappings with stored legacy password hash: `214230`
  - mapping statuses: `created=214032`, `created_duplicate_email=192`, `mapped=6`
  - unmapped source users: `0`
- Deployment:
  - deployed image: `localhost:5000/auth-microservice:b616818-20260612093355`
  - namespace: `statex-apps`
  - rollout completed successfully.
  - final pod health returned `{"success":true,"status":"ok","service":"auth-microservice"}`.

Guardrail:

- Password hashes were not printed in reports or status.
- Legacy hashes are stored only in the auth-owned mapping table and are intended to be cleared per user after first successful legacy password login.
- User-service write migration was not executed yet.

Next:

- Goal 4.11: re-run and harden user-service profile migration so it resolves target auth UUIDs from `legacy_identity_mappings` by legacy `auth_user.id`, not email-only matching.

## 2026-06-12 - Goal 4.11 User/Profile Auth Mapping Dry-Run

Status: done

Changed:

- Updated `/home/ssf/Documents/Github/speakasap/user-service/scripts/migrate-user-from-legacy.py`.
- Replaced email-only auth UUID resolution with auth-owned `legacy_identity_mappings` lookup by legacy `auth_user.id`.
- Updated dry-run unresolved-auth reporting to use the same mapping-table identity source.
- Updated future write-mode helpers for `user_identity_mirror`, `students`, `teachers`, `managers`, and `employee_profiles` to resolve by legacy user ID.
- Optimized dry-run reconciliation with temporary-table joins for large auth mapping and target conflict sets.

Evidence:

- `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py` passed locally and on `alfares`.
- No-write dry-run report: `/tmp/speakasap-user-dry-run-auth-mapping-v3.json`.
- Dry-run summary:
  - `writes=false`
  - `dry_run=true`
  - auth mapping size: `214230`
  - unresolved auth users: `0`
  - unresolved students: `0`
  - unresolved teachers: `0`
  - unresolved managers: `0`
  - unresolved employee profiles: `0`
- Source counts:
  - `auth_user=214230`
  - `students_student=214188`
  - `employees_teacher=380`
  - `employees_manager=3`
  - `employees_employeeprofile=8`
  - `employees_teacher_additional_languages=80`
- Source duplicate-key counts are `0` for user IDs and teacher-language pairs.
- Missing reference counts are `0` for auth users, managers, teacher languages, and teacher additional language references.
- Target user-service tables are currently empty:
  - `user_identity_mirror=0`
  - `students=0`
  - `teachers=0`
  - `managers=0`
  - `employee_profiles=0`
  - `teacher_additional_languages=0`
- Target ID conflicts are `0`.
- Target auth UUID conflicts are `0`.

Guardrail:

- User-service write migration was not executed.
- The user-service script still does not create or mutate auth users; it only references auth UUIDs supplied by `auth-microservice` mappings.

Next:

- Goal 4.12: review the user/profile dry-run evidence and run write-gated user-service apply only after explicit owner approval.

## 2026-06-12 - Goal 4.12 User/Profile Apply Gate Review

Status: awaiting owner approval

Changed:

- Reviewed the user/profile no-write dry-run evidence from `/tmp/speakasap-user-dry-run-auth-mapping-v3.json` on `alfares`.
- Hardened `user-service/scripts/migrate-user-from-legacy.py` so write mode is no longer the default when `--dry-run` is omitted.
- Added explicit write gates: `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan`.
- Added pre-apply rollback SQL generation for legacy user/profile rows and optional post-apply JSON reporting.
- Copied the gated script to `/home/ssf/Documents/Github/speakasap/user-service/scripts/migrate-user-from-legacy.py` on `alfares`.

Evidence:

- RAG retrieval from `docs-rag-microservice.statex-apps.svc.cluster.local:3397` was attempted from the local session and timed out, so repository and remote report evidence were used.
- Dry-run report reviewed on `alfares`: `/tmp/speakasap-user-dry-run-auth-mapping-v3.json`.
- Dry-run summary:
  - `writes=false`
  - `auth_mapping_size=214230`
  - unresolved auth counts for auth users, students, teachers, managers, and employee profiles are all `0`
  - missing source references are all `0`
  - target user-service tables are all empty
  - target ID conflicts are all `0`
  - target auth UUID conflicts are all `0`
  - `teacher_additional_languages` replacement scope is `0`
- Remote verification passed:
  - `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py`
  - `python3 user-service/scripts/migrate-user-from-legacy.py --help` shows `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan`
  - default write mode refuses before DB connection: `Refusing to write by default; use --dry-run for reconciliation or --apply with write gates`
  - incomplete apply refuses before DB connection without `--confirm-write`, without `--approval-note`, and without `--rollback-plan`
- A fresh dry run with the gated script was attempted, but `AUTH_DATABASE_URL` currently points to `127.0.0.1:5432` on `alfares` and that connection refused. The existing v3 dry-run remains the reviewed data evidence, and the final pre-apply dry run must be rerun after the auth DB connection is restored.

Guardrail:

- User-service apply was not run in this session because explicit owner approval for the user-service write migration was not provided.
- User-service migration still only reads auth-owned `legacy_identity_mappings`; it does not create or mutate auth users.

Prepared apply command after explicit owner approval and restored DB connectivity:

```bash
cd /home/ssf/Documents/Github/speakasap
set -a && . ./.env && set +a
python3 user-service/scripts/migrate-user-from-legacy.py \
  --apply \
  --confirm-write \
  --approval-note "OWNER_APPROVAL_TEXT_AND_DATE" \
  --rollback-plan /tmp/speakasap-user-profile-rollback-apply-v1.sql \
  --json-report > /tmp/speakasap-user-profile-apply-v1.json
```

Next:

- Get explicit owner approval for the user-service write migration, restore the auth DB connection for the final pre-apply dry run, then run the gated apply and capture post-apply counts.

## 2026-06-12 - Goal 4.12 User/Profile Write Migration Applied

Status: done

Changed:

- Owner explicitly approved the user-service write migration from the legacy SpeakASAP portal to the new `user-service`.
- Preserved the intended two-copy migration state: legacy portal Postgres remains the legacy/reference copy, and `user-service` now owns a migrated profile-domain copy. Auth identities remain owned by `auth-microservice`.
- Hardened `auth-microservice/scripts/bootstrap-speakasap-legacy-users.ts` so catch-up apply skips existing `legacy_identity_mappings` by legacy user ID before creating auth users.
- Ran a targeted auth-owned catch-up for one newly observed legacy user that appeared after the earlier auth bootstrap.
- Ran the write-gated `user-service/scripts/migrate-user-from-legacy.py --apply` with `--confirm-write`, owner approval note, rollback SQL path, and JSON report.

Evidence:

- Final pre-apply user dry-run before auth catch-up: `/tmp/speakasap-user-dry-run-auth-mapping-v5.json`.
  - Found one newly observed unmapped legacy identity: `auth_user.id=314012`, student `215047`.
- Narrow auth check for legacy user `314012`:
  - active end-user
  - `same_normalized_email_count=1`
  - `existing_mapping_count=0`
- Auth catch-up direct verification:
  - `legacy_identity_mappings` has one row for `legacyUserId=314012`
  - catch-up mapping status: `created`
  - total SpeakASAP legacy auth mappings: `214231`
- Final pre-apply user dry-run after auth catch-up: `/tmp/speakasap-user-dry-run-auth-mapping-v6.json`.
  - `writes=false`
  - `auth_mapping_size=214231`
  - unresolved auth counts for auth users, students, teachers, managers, and employee profiles are all `0`
  - missing source references are all `0`
  - target user-service tables were still empty
  - target ID conflicts and target auth UUID conflicts were all `0`
- User-service apply artifacts:
  - apply report: `/tmp/speakasap-user-profile-apply-v1.json`
  - rollback SQL: `/tmp/speakasap-user-profile-rollback-apply-v1.sql`
- User-service apply report:
  - `writes=true`
  - `user_identity_mirror=214231`, skipped `0`
  - `students=214189`, skipped `0`
  - `teachers=380`, skipped `0`
  - `managers=3`, skipped `0`
  - `employee_profiles=8`, skipped `0`
  - `teacher_additional_languages=80`
  - elapsed time `81.9s`
- Direct post-apply DB counts:
  - `user_identity_mirror=214231`
  - `students=214189`
  - `teachers=380`
  - `managers=3`
  - `employee_profiles=8`
  - `teacher_additional_languages=80`
- Post-apply no-write dry-run: `/tmp/speakasap-user-dry-run-post-apply-v1.json`.
  - `writes=false`
  - `auth_mapping_size=214231`
  - unresolved auth counts remain `0`
- Runtime check:
  - `kubectl exec -n statex-apps deploy/speakasap-user -- ... /health` returned `{"status":"ok"}`.

Guardrail:

- No legacy portal rows were deleted or mutated.
- No user-service truncation was used.
- The user-service migration did not create or mutate auth users; the one required auth catch-up was performed through the auth-owned bootstrap path.
- A temporary Kubernetes port-forward was used for DB access and was closed after each command.

Next:

- Goal 4.13: finish education/course apply-gate readiness and capture final pre-apply dry-run reports before any education or course data writes.

## 2026-06-12 - Goal 4.12 User/Profile Apply And Post-Apply Reconciliation

Status: done

Changed:

- Completed the write-gated user-service legacy user/profile import on `alfares`.
- Captured rollback SQL before apply at `/tmp/speakasap-user-profile-rollback-apply-v1.sql`.
- Captured apply evidence at `/tmp/speakasap-user-profile-apply-v1.json`.
- Captured post-apply no-write reconciliation at `/tmp/speakasap-user-dry-run-post-apply-v1.json`.
- Hardened `education-service/scripts/migrate-education-from-legacy.py` and `course-service/scripts/migrate-course-from-legacy.py` so both refuse default writes and require `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan`.
- Marked Goal 4.12 complete and moved the active chunk to Goal 4.13 education/course apply-gate readiness.

Evidence:

- RAG retrieval was attempted from the local session and failed with curl exit code 6, so repository and remote runtime evidence were used.
- User-service apply report:
  - `writes=true`
  - approval note recorded in the report: `Owner approved user-service write migration from legacy SpeakASAP portal to new user-service on 2026-06-12`
  - `user_identity_mirror=214231`
  - `students=214189`
  - `teachers=380`
  - `managers=3`
  - `employee_profiles=8`
  - `teacher_additional_languages=80`
  - skipped auth counts for all imported groups are `0`
- Post-apply dry-run report:
  - `writes=false`
  - `auth_mapping_size=214231`
  - unresolved auth counts for auth users, students, teachers, managers, and employee profiles are all `0`
  - target counts match the apply report counts
  - target ID/auth conflict counts now equal imported row counts, which is expected for an idempotent post-apply reconciliation.
- Education/course script verification passed on `alfares`:
  - `python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py course-service/scripts/migrate-course-from-legacy.py`
  - both `--help` outputs show `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan`
  - default invocation exits with code `2` and refuses writes before database connection
  - incomplete `--apply` exits with code `2` and refuses before database connection without `--confirm-write`.

Guardrail:

- No education-service or course-service data writes were run in this step.
- The user-service rollback SQL is available but was not executed because post-apply reconciliation is consistent.
- Lesson-recording/private media migration remains pending until education core data is loaded and reconciled.

Next:

- Goal 4.13: run final no-write dry-runs for education and course through a temporary Postgres port-forward, then run their write-gated applies only with matching approval evidence and rollback artifacts.

## 2026-06-12 - Goal 4.13 Course/Education Apply And Lesson-Record Unblocker

Status: done

Changed:

- Ran final no-write pre-apply dry-runs for course and education migrations.
- Ran write-gated course migration apply with rollback artifact `/tmp/speakasap-course-rollback-apply-v1.sql`.
- Ran write-gated education migration apply with rollback artifact `/tmp/speakasap-education-rollback-apply-v1.sql`.
- Captured post-apply no-write reconciliation reports:
  - `/tmp/speakasap-course-dry-run-post-apply-v1.json`
  - `/tmp/speakasap-education-dry-run-post-apply-v1.json`
- Re-ran lesson-record dry-run after education core data was loaded:
  - `/tmp/speakasap-lesson-records-dry-run-post-education-v1.json`
- Marked Goal 4.13 complete and moved active state to Goal 5.

Evidence:

- Pre-apply course dry-run `/tmp/speakasap-course-dry-run-pre-apply-v1.json`:
  - duplicate counts `0`
  - missing reference counts `0`
  - target table counts `0`
  - target key/pair conflicts `0`
- Course apply `/tmp/speakasap-course-apply-v1.log` wrote:
  - `products_category=5`
  - `products_partpaymentcollection=24`
  - `products_partpaymentoption=71`
  - `products_product=238`
  - `products_product_part_payments=108`
  - `offers_extralessonsoffer=994`
  - `offers_offer=1900`
- Post-apply course dry-run target counts match source counts; target conflicts equal imported rows as expected for an idempotent rerun check.
- Pre-apply education dry-run `/tmp/speakasap-education-dry-run-pre-apply-v1.json`:
  - duplicate counts `0`
  - missing reference counts `0`
  - target table counts `0`
  - target key/pair conflicts `0`
- Education apply `/tmp/speakasap-education-apply-v1.log` wrote:
  - `education_group=21476`
  - `education_group_students=21655`
  - `education_studentcourse=20125`
  - `education_lesson=182600`
  - `education_homework=52616`
  - `education_studentcourse.previous_id` patched rows `1883`
- Post-apply education dry-run target counts match source counts; target conflicts equal imported rows as expected for an idempotent rerun check.
- Lesson-record post-education dry-run:
  - `missing_target_lessons=0`
  - `bad_parts_json=0`
  - `duplicate_lesson_records=0`
  - `missing_source_lesson=0`
  - remaining media/key issues: `parts_missing_rows=4080`, `orphan_parts=5781`, `legacy_prefix_keys_without_date=25934`, `record_key_date_mismatch=39477`.

Guardrail:

- No legacy DB writes were performed.
- No object storage writes, deletes, or public recording exposure were performed.
- Rollback SQL artifacts were generated before course and education applies.

Next:

- Goal 5.1: add the target lesson-record schema/write-gated metadata migration and keep all recording object access private.

## 2026-06-12 - User/Profile Migration Batch Hardening

Status: done

Changed:

- Added `--batch-size` to `user-service/scripts/migrate-user-from-legacy.py`.
- Default batch size is `10000` rows.
- Future user/profile applies or idempotent reruns now process the two large write paths in batches:
  - `auth_user -> user_identity_mirror`
  - `students_student -> students`
- Each batch commits independently and logs cumulative migrated/skipped counts.

Evidence:

- No additional user-service write migration was run after this change.
- Local syntax check passed: `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py`.
- Remote syntax check passed on `alfares`.
- Remote help output shows `--batch-size BATCH_SIZE`.
- Invalid batch size refuses before database connection: `ERROR: --batch-size must be greater than 0`.

Note:

- The already completed Goal 4.12 apply ran before this owner instruction, so that historical run was not batched. The script is now hardened so future reruns use `10000`-row batches by default.

Next:

- Goal 4.13: use explicit batching for any future education/course data writes where table size or server limits make batching necessary.

## 2026-06-12 - Education/Course Apply Process Observed During Batch Hardening

Status: observed

Changed:

- While hardening user/profile batching, a separate remote education/course apply process was already running on `alfares`.
- The process was not started by this batching change.
- It was monitored to completion instead of being interrupted, because it had already written course and education target rows.

Evidence:

- Course apply log: `/tmp/speakasap-course-apply-v1.log`.
- Course rollback SQL: `/tmp/speakasap-course-rollback-apply-v1.sql`.
- Education apply log: `/tmp/speakasap-education-apply-v1.log`.
- Education rollback SQL: `/tmp/speakasap-education-rollback-apply-v1.sql`.
- Course target counts after process exit:
  - `products_category=5`
  - `products_partpaymentcollection=24`
  - `products_partpaymentoption=71`
  - `products_product=238`
  - `products_product_part_payments=108`
  - `offers_extralessonsoffer=994`
  - `offers_offer=1900`
- Education target counts after process exit:
  - `education_group=21476`
  - `education_group_students=21655`
  - `education_studentcourse=20125`
  - `education_lesson=182600`
  - `education_homework=52616`
- No lingering `port-forward`, education migration, or course migration process remained after completion.

Guardrail:

- This observation does not imply that future large migrations should run unbatched. The active owner instruction is to batch large write paths around `10000` rows per batch where server limits matter.

Next:

- Capture post-apply reconciliation for education/course and retrofit batching before any further large write/rerun.

## 2026-06-12 - Education/Course Batch Hardening

Status: done

Changed:

- Added `--batch-size` to `education-service/scripts/migrate-education-from-legacy.py`.
- Added `--batch-size` to `course-service/scripts/migrate-course-from-legacy.py`.
- Default batch size is `10000` rows.
- Future education/course applies or idempotent reruns now stream source rows with server-side cursors and commit per batch instead of loading whole tables with `fetchall()`.
- Education batching covers:
  - `education_group`
  - `education_group_students`
  - `education_studentcourse` phase 1
  - `education_studentcourse.previous_id` patch phase
  - `education_lesson`
  - `education_homework`
- Course batching covers all copied tables:
  - `products_category`
  - `products_partpaymentcollection`
  - `products_partpaymentoption`
  - `products_product`
  - `products_product_part_payments`
  - `offers_extralessonsoffer`
  - `offers_offer`

Evidence:

- No additional education/course write migration was run by this hardening step.
- Remote syntax check passed on `alfares`:
  - `python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py course-service/scripts/migrate-course-from-legacy.py`
- Remote help output for both scripts shows `--batch-size BATCH_SIZE`.
- Invalid batch size refuses before database connection for both scripts:
  - `ERROR: --batch-size must be greater than 0`
- `education-service/scripts/migrate-lesson-records-from-legacy.py` is currently read-only only; it has no lesson-record write/apply path to batch yet.

Guardrail:

- Future large writes should keep the default `--batch-size 10000` unless there is explicit evidence that the server can safely handle a larger batch.
- Existing target conflict guards still run before non-truncating apply, so an idempotent rerun should refuse rather than duplicate rows unless a separately approved path is used.

Next:

- Add batching to the lesson-record metadata write path when that write path is implemented; until then, lesson-record migration remains dry-run/reconciliation only.

## 2026-06-12 - Intent Preservation System Compliance Refresh

Status: done

Changed:

- Added missing root mandatory-reading files: `BUSINESS.md`, `SYSTEM.md`, `TASKS.md`, and `STATE.json`.
- Added `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md` with staged migration checks, implementation prerequisites, write/destructive-action gates, verification gates, rollback expectations, and required commit-message evidence.
- Updated `AGENTS.md`, `MASTER_PROMPT.md`, `IMPLEMENTATION_ORCHESTRATOR.md`, `IMPLEMENTATION_STATE.md`, `INTENT.md`, `GOALS.md`, `PROMPTS.md`, root `PLAN.md`, `docs/orchestrator/PLAN.md`, root `STATE.json`, and `docs/orchestrator/STATE.json` to make the intent-preservation system part of the required workflow.
- Preserved the active roadmap state at Goal 4.13: education/course apply-gate readiness remains blocked on final no-write reports and explicit owner approval before writes.

Evidence:

- Local mandatory reading initially failed for root `BUSINESS.md`, `SYSTEM.md`, `TASKS.md`, and `STATE.json`; those files now exist.
- RAG lookup to `docs-rag-microservice.statex-apps.svc.cluster.local:3397` timed out with curl exit code 28 both sandboxed and with approved network access, so this pass used repository evidence.
- Reviewed current root and orchestrator docs in this checkout, including `AGENTS.md`, root `PLAN.md`, `docs/orchestrator/MASTER_PROMPT.md`, `IMPLEMENTATION_ORCHESTRATOR.md`, `IMPLEMENTATION_STATE.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `STATUS.md`, `PROMPTS.md`, `MIGRATION_EVIDENCE.md`, `SOURCE_TARGET_MAPPING.md`, `OBJECTIVE_COMPLETION_AUDIT.md`, and `AUTH_BOOTSTRAP_APPLY_GATE.md`.
- No production code, migration write mode, deployment, or database write was changed by this compliance refresh.
- JSON validation passed for root `STATE.json` and `docs/orchestrator/STATE.json`.

Next:

- Goal 4.13 remains the active migration task: capture final education/course no-write dry-runs before any write-gated apply.

## 2026-06-12 - Goal 4.12 Final Pre-Apply Evidence Restored

Status: done

Changed:

- Restored the final pre-apply DB evidence for the user/profile migration as the authoritative Goal 4.12 pre-write checkpoint.
- Hardened `user-service/scripts/migrate-user-from-legacy.py` so CLI write-gate checks run before database URL checks or DB driver import.
- Copied the hardened script to `/home/ssf/Documents/Github/speakasap/user-service/scripts/migrate-user-from-legacy.py` on `alfares`.
- Reaffirmed that any future user-service write migration, rerun, truncation, rollback execution, or apply against a changed source/target requires fresh explicit owner approval, a current no-write report, an approval note, and rollback artifact.

Evidence:

- RAG retrieval to `docs-rag-microservice.statex-apps.svc.cluster.local:3397` failed with curl exit code `6`, so repository and remote runtime evidence were used.
- Remote artifacts are present on `alfares`:
  - `/tmp/speakasap-user-dry-run-auth-mapping-v6.json`
  - `/tmp/speakasap-user-profile-rollback-apply-v1.sql`
  - `/tmp/speakasap-user-profile-apply-v1.json`
  - `/tmp/speakasap-user-dry-run-post-apply-v1.json`
- Restored final pre-apply report: `/tmp/speakasap-user-dry-run-auth-mapping-v6.json`.
  - `writes=false`
  - `dry_run=true`
  - `auth_mapping_size=214231`
  - source counts: `auth_user=214231`, `students_student=214189`, `employees_teacher=380`, `employees_manager=3`, `employees_employeeprofile=8`, `employees_teacher_additional_languages=80`
  - unresolved auth counts for auth users, students, teachers, managers, and employee profiles are all `0`
  - missing source references are all `0`
  - source duplicate-key counts are all `0`
  - target user-service counts were all `0` before apply
  - target ID conflicts and target auth UUID conflicts were all `0`
  - replacement scope for `teacher_additional_languages` was `0`
- Apply evidence remains unchanged:
  - apply report `/tmp/speakasap-user-profile-apply-v1.json` recorded `writes=true`
  - approval note in the apply report: `Owner approved user-service write migration from legacy SpeakASAP portal to new user-service on 2026-06-12`
  - migrated counts: `user_identity_mirror=214231`, `students=214189`, `teachers=380`, `managers=3`, `employee_profiles=8`, `teacher_additional_languages=80`
  - skipped no-auth counts for imported groups are all `0`
- Post-apply reconciliation remains unchanged:
  - `/tmp/speakasap-user-dry-run-post-apply-v1.json` recorded `writes=false`
  - `auth_mapping_size=214231`
  - unresolved auth counts remain `0`
- Local verification:
  - `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py` passed
  - `python3 user-service/scripts/migrate-user-from-legacy.py` exits `2` with default write refusal before DB config
  - `python3 user-service/scripts/migrate-user-from-legacy.py --apply` exits `2` without `--confirm-write`
  - `python3 user-service/scripts/migrate-user-from-legacy.py --apply --confirm-write` exits `2` without `--approval-note`
  - `python3 user-service/scripts/migrate-user-from-legacy.py --apply --confirm-write --approval-note test` exits `2` without `--rollback-plan`
- Remote verification on `alfares`:
  - `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py` passed
  - default invocation exits `2` with write refusal before DB config
  - incomplete `--apply` invocations exit `2` without `--confirm-write`, without `--approval-note`, and without `--rollback-plan`

Guardrail:

- No user-service write migration, rollback, truncation, or deployment was run in this restoration step.
- The existing historical Goal 4.12 apply is not treated as standing approval for future user-service writes.
- Future user-service applies must use `--apply --confirm-write --approval-note ... --rollback-plan ...` after a fresh owner approval and fresh no-write DB evidence.

Next:

- Resume the current data-migration roadmap only after honoring this gate: any future user-service write action requires explicit owner approval; education/course or lesson-record work remains separately gated by its own final dry-runs and approval evidence.

## 2026-06-12 - Goal 5.2 Lesson Recording Metadata Migration Implementation

Status: implemented locally; remote apply/deploy not run

Changed:

- Added `education-service/prisma/schema.prisma` coverage for `LessonRecord` and `LessonRecordPart`.
- Added Prisma migration `education-service/prisma/migrations/20260612120000_lesson_record_metadata/migration.sql`.
- Replaced `education-service/scripts/migrate-lesson-records-from-legacy.py` with a dual-mode migration:
  - `--dry-run` remains no-write reconciliation.
  - `--apply` requires `--confirm-write`, `--approval-note`, and `--rollback-plan`.
  - apply mode refuses if target lesson-record tables are missing.
  - writes are idempotent upserts by preserved legacy UUIDs.
  - rollback SQL is generated before writes.
  - metadata/key references are migrated only; object storage is not read, written, deleted, or made public.

Evidence:

- RAG lookup to `docs-rag-microservice.statex-apps.svc.cluster.local:3397` failed with curl exit code `6`, so repository evidence was used.
- Local verification passed:
  - `python3 -m py_compile education-service/scripts/migrate-lesson-records-from-legacy.py`
  - `python3 education-service/scripts/migrate-lesson-records-from-legacy.py --help`
  - `python3 education-service/scripts/migrate-lesson-records-from-legacy.py --apply` exits `2` before DB access and reports missing write-gate flags.
  - `python3 education-service/scripts/migrate-lesson-records-from-legacy.py --dry-run` exits `1` before DB access and reports missing source DB URL.
- Private media boundary:
  - the schema stores `record` and `part_file` object keys only;
  - no public URL, bucket credential, object copy, object delete, or presigned access behavior was added;
  - old-prefix and key-date mismatches remain reconciliation issues and are not rewritten by the metadata import.
- Blocking apply issues are separated from non-blocking media/key reconciliation:
  - missing target lessons, duplicate lesson records, target UUID/lesson conflicts, bad parts JSON, and multi-record part references block apply;
  - orphan part rows, missing part rows, old-prefix keys, and key-date mismatches remain reported as reconciliation evidence.

Remote blocker:

- Copying the changed artifacts to `alfares` failed because the local SSH config currently resolves `alfares` to `alfares.local`, and DNS lookup for `alfares.local` fails in this session.
- Remote Prisma validation, `npm run build`, DB-backed dry-run, and any write-gated apply were not run.

Approval / rollback:

- No production or target database write was run.
- Future apply still requires a fresh DB-backed no-write report, Prisma migration deploy, explicit owner approval for the exact apply command, and a rollback SQL path.

Next:

- Restore remote `alfares` connectivity, copy the local artifacts, run `education-service` Prisma validation/build, deploy the schema migration, capture a fresh no-write lesson-record report, then request explicit approval before any `--apply`.

## 2026-06-12 - Goal 5.3 Lesson Recording Remote Validation

Status: remote validation and no-write report complete; schema deploy/apply still approval-gated

Changed:

- Copied the local lesson-record schema, migration SQL, and migration script to `/home/ssf/Documents/Github/speakasap` on `alfares`.
- Used direct IPv6 link-local SSH with `HostKeyAlias=alfares.local` because the plain `alfares` alias intermittently failed resolving `alfares.local`.
- Ran remote validation and no-write reconciliation only.

Evidence:

- Remote validation passed:
  - `python3 -m py_compile education-service/scripts/migrate-lesson-records-from-legacy.py`
  - `python3 education-service/scripts/migrate-lesson-records-from-legacy.py --help`
  - `cd education-service && npm run prisma:validate`
  - `cd education-service && npm run build`
- Target DB access required a temporary Kubernetes port-forward to `svc/db-server-postgres` in namespace `statex-apps`; the port-forward was closed after the command.
- Fresh no-write report: `/tmp/speakasap-lesson-records-dry-run-g5-2.json`.
- Dry-run summary:
  - `source_lesson_records=101184`
  - `source_lesson_record_parts=58234`
  - `records_ready=96729`
  - `records_processing=1414`
  - `records_unavailable=2332`
  - `records_none=2`
  - `records_inconsistent=4787`
  - `missing_target_lesson=0`
  - `parts_missing_rows=4080`
  - `parts_orphan_rows=5781`
  - `keys_canonical=71919`
  - `keys_old_prefix_legacy=25934`
  - `keys_empty=3042`
  - `keys_other=289`
  - `would_upsert_lesson_records=101184`
  - `would_upsert_lesson_record_parts=52453`
  - blocking issue counts are zero for bad JSON, missing source lesson, missing target lesson, duplicate lesson records, and multi-record part references.
  - remaining non-blocking reconciliation issues: `legacy_prefix_keys_without_date=25934`, `orphan_parts=5781`, `parts_missing_rows=4080`, `record_key_date_mismatch=39477`.

Approval / rollback:

- No Prisma migration deploy, target schema write, metadata apply, object storage write, or deployment was run.
- Next write step requires explicit owner approval for:
  - `cd education-service && npm run prisma:migrate:deploy`
  - `education-service/scripts/migrate-lesson-records-from-legacy.py --apply --confirm-write --approval-note ... --rollback-plan ...`

Next:

- Request explicit owner approval for the target DB schema migration and the lesson-record metadata apply command, with rollback path recorded before apply.

## 2026-06-12 - Goal 5.4 Lesson Recording Schema Deploy And Metadata Apply

Status: done

Changed:

- Owner approved proceeding with the `education-service` Prisma schema deploy and lesson-record metadata apply on 2026-06-12.
- Recorded owner permission in `AGENTS.md` allowing AI/Codex sessions to create git commits on remote `alfares` only inside `/home/ssf/Documents/Github/speakasap`.
- Applied Prisma migration `20260612120000_lesson_record_metadata` to `speakasap_education_db`.
- Ran the write-gated lesson-record metadata apply with:
  - `--apply`
  - `--confirm-write`
  - `--approval-note "Owner approved lesson-record schema deploy and metadata apply for SpeakASAP on 2026-06-12"`
  - `--rollback-plan /tmp/speakasap-lesson-records-rollback-g5-4.sql`
  - `--json-report /tmp/speakasap-lesson-records-apply-g5-4.json`
- Ran a post-apply no-write reconciliation report at `/tmp/speakasap-lesson-records-post-apply-g5-4.json`.

Evidence:

- Prisma deploy:
  - `cd education-service && npm run prisma:migrate:deploy`
  - migration applied successfully: `20260612120000_lesson_record_metadata`
- Rollback artifact:
  - `/tmp/speakasap-lesson-records-rollback-g5-4.sql`
- Apply report:
  - `/tmp/speakasap-lesson-records-apply-g5-4.json`
  - `writes=true`
  - `source_lesson_records=101184`
  - `source_lesson_record_parts=58234`
  - `would_upsert_lesson_records=101184`
  - `would_upsert_lesson_record_parts=52453`
  - `missing_target_lesson=0`
- Target DB verification after apply:
  - `education_lessonrecord=101184`
  - `education_lessonrecordpart=52453`
  - lesson-record rows missing target lessons: `0`
- Post-apply dry-run report:
  - `/tmp/speakasap-lesson-records-post-apply-g5-4.json`
  - `missing_target_lesson=0`
  - source/state/key counts match the pre-apply evidence
  - remaining reconciliation issues are unchanged media/key inventory: `parts_missing_rows=4080`, `orphan_parts=5781`, `legacy_prefix_keys_without_date=25934`, `record_key_date_mismatch=39477`

Guardrail:

- No object storage read, write, delete, public URL, or presigned access change was performed.
- The apply migrated metadata and private object-key references only.
- Temporary Kubernetes DB port-forwards were closed after the commands.

Next:

- Continue Goal 5 by verifying runtime private access behavior: playback/download must remain scoped, merge/delete behavior must be checked against legacy semantics, and media/key reconciliation issues must remain visible until resolved or explicitly accepted.

## 2026-06-12 - Goal 5.5 Runtime Private Access Verification

Status: active; frontend/gateway cutover blocked

Changed:

- Added `docs/orchestrator/LESSON_RECORDING_RUNTIME_VERIFICATION.md`.
- Verified the current target service/runtime surface before any frontend or gateway cutover.
- Ran a fresh no-write lesson-record metadata/target reconciliation report.

Evidence:

- RAG lookup failed with curl exit code 6, so repository and remote evidence were used.
- Remote repo `/home/ssf/Documents/Github/speakasap` was clean before verification.
- Target runtime search found no implemented `education-service` route/module for lesson-record state, playback, download, presign, commit, scoped media token, merge worker, stuck-record worker, or delete behavior.
- `education-service/src/lessons/lessons.controller.ts` currently exposes only staff-only lesson list/detail routes.
- `api-gateway` docs map `/api/v1/lessons/:lessonUuid/record*` to `education-service`, but no target runtime route exists to receive those requests.
- Legacy evidence reviewed:
  - `speakasap-portal/cabinet/record_playback.py`
  - `speakasap-portal/cabinet/views.py`
  - `speakasap-portal/cabinet/teacher/views/lessons.py`
  - `speakasap-portal/education/tasks.py`
  - `speakasap-portal/education/lesson_records/tests/test_lesson_records.py`
  - `speakasap-portal/portal/utils/records_storage.py`
- Fresh no-write report: `/tmp/speakasap-lesson-records-g5-5-target-verification.json`.
- Report summary:
  - `writes=false`
  - `source_lesson_records=101184`
  - `target_lesson_records_existing=101184`
  - `source_lesson_record_parts=58234`
  - `would_upsert_lesson_record_parts=52453`
  - `missing_target_lesson=0`
  - `duplicate_lesson_records=0`
  - `part_referenced_by_multiple_records=0`
  - `bad_parts_json=0`
  - `records_ready=96729`
  - `records_processing=1414`
  - `records_unavailable=2332`
  - `records_none=2`
  - `records_inconsistent=4787`
  - remaining media/key inventory remains `parts_missing_rows=4080`, `orphan_parts=5781`, `legacy_prefix_keys_without_date=25934`, and `record_key_date_mismatch=39477`.
- Temporary Kubernetes target DB port-forward was closed after the no-write report.

Intent / ownership:

- Lesson-record metadata remains private and key-only in `education-service`.
- No object storage read, write, delete, public URL, presigned access change, deployment, frontend change, or gateway cutover was performed.
- Runtime access still must be owned by `education-service` behind `api-gateway`; object storage remains owned by `minio-microservice`.

Cutover gate:

- Goal 5.5 cannot be marked done yet because target runtime private playback/download, merge/delete, and failure-mode checks do not exist.
- Frontend or gateway cutover for recordings must remain blocked until target runtime endpoints and tests/smoke checks cover unauthorized access, paid/student eligibility, teacher assignment, staff policy, one-hour scoped token/presign expiry, old/new key fallback, helper/storage failures, merge idempotence, and safe part deletion behavior.

Next:

- Implement the target `education-service` lesson-recording runtime module and tests without changing frontend/gateway cutover; defer object deletion or production access changes until explicit owner approval and rollback evidence are recorded.

## 2026-06-12 - Goal 5.5 Lesson Recording Runtime Module Scaffold

Status: in progress; build verified; cutover still blocked

Changed:

- Added `education-service/src/lesson-records/` with a `LessonRecordsModule`.
- Registered the module in `education-service/src/app.module.ts`.
- Added gateway-aligned target routes under `education-service`:
  - `GET /api/v1/lessons/:lessonUuid/record`
  - `GET /api/v1/lessons/:lessonUuid/record/playback`
  - `GET /api/v1/lessons/:lessonUuid/record/download?token=...`
  - `POST /api/v1/lessons/:lessonUuid/record/presign`
  - `POST /api/v1/lessons/:lessonUuid/record/commit`
  - `POST /api/v1/lessons/:lessonUuid/record/merge`
  - `DELETE /api/v1/lessons/:lessonUuid/record`
- Added scoped playback media-token signing/verification with max TTL `3600` seconds.
- Added private helper-proxied download streaming that uses `RECORDS_S3_HELPER_URL` plus `RECORDS_S3_BUCKET`, preserves range headers, and tries key fallback with and without `courses/records/`.
- Added user-service profile lookup for teacher/student legacy IDs via `USER_SERVICE_URL` and bearer token.
- Added `education-service/scripts/verify-lesson-record-runtime-contract.js` and package script `npm run test:lesson-records`.

Intent / ownership:

- Owner replied `agree` on 2026-06-12 to continue the next Goal 5.5 implementation chunk.
- No deployment, gateway/frontend cutover, object storage mutation, object deletion, or public/permanent URL exposure was performed.
- Runtime routes are implemented in `education-service` behind existing `/api/v1/lessons` gateway ownership.
- Identity remains owned by `auth-microservice`; `education-service` resolves domain profile IDs through `user-service` rather than inventing identities.
- Object storage remains private; download is helper-proxied and token-scoped.

Guardrails still active:

- Student playback is deliberately blocked with `Student paid lesson-record access is not implemented in target data yet` because no migrated `StudentAccess`/paid lesson eligibility table exists in the target education schema.
- Presign and commit routes perform JWT and lesson-level teacher/staff authorization, then return service-unavailable until the private upload adapter and object metadata verification are implemented.
- Merge route performs JWT and lesson-level teacher/staff authorization, then returns service-unavailable until the target merge worker is implemented.
- Delete route performs JWT and lesson-level teacher/staff authorization, then refuses with conflict because object deletion requires explicit owner approval and rollback evidence.

Verification:

- `ssh alfares 'cd /home/ssf/Documents/Github/speakasap/education-service && npm run build'` passed.
- `ssh alfares 'cd /home/ssf/Documents/Github/speakasap/education-service && npm run test:lesson-records'` passed.
- Previous fresh no-write DB report remains `/tmp/speakasap-lesson-records-g5-5-target-verification.json` with `writes=false`, `target_lesson_records_existing=101184`, and `missing_target_lesson=0`.

Remaining blockers before cutover:

- Add or map target paid lesson eligibility equivalent to legacy `StudentAccess.is_paid` before student playback can be enabled.
- Implement private upload presign/commit with 900-second PUT expiry, audio content-type/60MB validation, object key validation, and ETag/size verification.
- Implement or explicitly defer target merge worker parity; no part deletion may run until merged output validation is implemented.
- Define owner-approved delete semantics and rollback before any target object deletion is enabled.
- Add runtime smoke tests against deployed service only after deployment approval.

Next:

- Continue Goal 5.5 by resolving paid student eligibility mapping and implementing private upload presign/commit or recording the owner-approved deferral before any frontend/gateway cutover.

## 2026-06-12 - Goal 5.5 Paid Eligibility Mapping And Private Upload Runtime

Status: implementation added; schema/data apply and deployment remain approval-gated

Changed:

- Added target Prisma model `StudentAccess` mapped to `education_studentaccess`.
- Added Prisma migration `20260612143000_student_access`.
- Extended `education-service/scripts/migrate-education-from-legacy.py` to include `education_studentaccess` in:
  - source counts;
  - duplicate UUID checks;
  - duplicate `(lesson_id, student_id)` checks;
  - missing lesson reference checks;
  - target conflict checks;
  - write-gated copy order;
  - rollback/truncate SQL order.
- Updated `education-service/src/lesson-records` so student playback now requires target paid access (`StudentAccess.isPaid`) instead of only group membership.
- Implemented private upload presign:
  - assigned teacher or staff authorization;
  - optional `studentId` group membership validation;
  - `kind=lesson|part`;
  - `contentType` must start with `audio/`;
  - size must be `0..62914560`;
  - legacy-compatible keys `YYYY/MM/DD/lesson_<lesson_uuid>.<ext>` and `YYYY/MM/DD/parts_<part_uuid>.<ext>`;
  - path-style SigV4 PUT URL with 900-second max expiry.
- Implemented private upload commit:
  - assigned teacher or staff authorization;
  - expected-key validation;
  - S3/MinIO HEAD metadata check;
  - optional ETag check;
  - size check;
  - DB metadata update for full lesson recording, part uploads, or unavailable recording.
- Added `USER_SERVICE_URL: "http://speakasap-user:4207"` to `k8s/services/education-service.yaml`.
- Updated `education-service/scripts/verify-lesson-record-runtime-contract.js` to assert paid access mapping and presign/commit storage checks.

Intent / ownership:

- Legacy paid playback behavior maps from `education_studentaccess.is_paid` to target `StudentAccess.isPaid`.
- Auth identity remains owned by `auth-microservice`; teacher/student legacy IDs are resolved via `user-service`.
- Object storage remains owned by MinIO/storage infrastructure; `education-service` only generates scoped private access and verifies object metadata.
- No object deletion, merge worker execution, deployment, frontend cutover, gateway cutover, Prisma migrate deploy, or target data apply was run.

Verification:

- `ssh alfares 'cd /home/ssf/Documents/Github/speakasap/education-service && npm run prisma:validate && npm run build && npm run test:lesson-records'` passed.
- `ssh alfares 'cd /home/ssf/Documents/Github/speakasap && python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py'` passed.
- `ssh alfares 'cd /home/ssf/Documents/Github/speakasap && python3 education-service/scripts/migrate-education-from-legacy.py --help'` passed.
- Default write refusal passed:
  - `python3 education-service/scripts/migrate-education-from-legacy.py`
  - exited `2` with `Refusing to write by default`.
- Source-only dry run for student access passed without target writes:
  - `education_studentaccess=184464`
  - duplicate `education_studentaccess.uuid=0`
  - duplicate `education_studentaccess.lesson_student=0`
  - `student_access_missing_lesson=0`

Approval / rollback:

- Applying `20260612143000_student_access`, importing `education_studentaccess`, deploying `speakasap-education`, or enabling frontend/gateway traffic still requires explicit owner approval and fresh target dry-run evidence.
- Target object deletion remains disabled and still requires a separate owner-approved rollback plan.

Remaining blockers before cutover:

- Run target DB dry-run/check after the new `education_studentaccess` schema migration is approved for deploy.
- Apply/import `education_studentaccess` only after explicit write approval and rollback SQL.
- Add runtime smoke tests after deployment approval for unauthorized playback, unrelated student, unpaid student, paid student, assigned teacher, unassigned teacher, presign invalid content type/size/key, commit ETag/size mismatch, and old/new key fallback.
- Implement or defer merge-worker parity; no source part deletion may be enabled until merged output validation exists.

Next:

- Request approval for `education-service` Prisma migration deploy and write-gated `education_studentaccess` import, backed by a fresh target dry-run and rollback artifact.

## 2026-06-12 - Goal 5.5 Student Access Schema Deploy And Import

Status: done for paid eligibility data apply; deployment/cutover still blocked

Approval:

- Owner replied `I approve.` on 2026-06-12 after the approval request for `education_studentaccess` schema deploy/import.

Changed / applied:

- Applied Prisma migration `20260612143000_student_access` to `speakasap_education_db`.
- Ran a fresh target dry-run before write:
  - report path: `/tmp/speakasap-education-studentaccess-dry-run-g5-5.json`
  - source `education_studentaccess=184464`
  - target `education_studentaccess=0`
  - target UUID conflicts `0`
  - target `(lesson_id, student_id)` conflicts `0`
  - source missing lesson references `0`
  - source duplicate UUIDs `0`
  - source duplicate lesson/student pairs `0`
- Ran write-gated student-access-only import:
  - command class: `migrate-education-from-legacy.py --apply --student-access-only --confirm-write --approval-note ... --rollback-plan ...`
  - approval note: `Owner approved education_studentaccess schema deploy and import for SpeakASAP Goal 5.5 on 2026-06-12`
  - rollback artifact: `/tmp/speakasap-education-studentaccess-rollback-g5-5.sql`
  - rows written before script exit: `184464`
- Fixed the scoped migration function after the first import attempt exited nonzero: it had copied all `education_studentaccess` rows, then attempted a second duplicate copy because the new scoped function accidentally included a second student-access copy. The target was complete and duplicate-free; the script now copies `education_studentaccess` only once and compiles.

Post-apply read-only verification:

- Target `education_studentaccess=184464`
- Target paid rows `184214`
- Source `education_studentaccess=184464`
- Source paid rows `184214`
- Target duplicate UUID groups `0`
- Target duplicate `(lesson_id, student_id)` groups `0`
- Target missing lesson references `0`
- Prisma migration state: `20260612143000_student_access|t`

Verification:

- `python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py` passed after the script fix.
- `git diff --check` passed.
- `STATE.json` and `docs/orchestrator/STATE.json` parse as JSON.
- Temporary Kubernetes DB port-forwards were closed after commands.

Guardrails:

- No `speakasap-education` deployment or rollout was run.
- No frontend/gateway cutover was run.
- No object storage write/delete/merge execution was run.
- Target record deletion remains disabled in code.

Next:

- Rebuild and deploy `speakasap-education` only after deployment approval, then run runtime smoke checks for paid/unpaid playback and presign/commit failure modes before frontend/gateway cutover.

## 2026-06-12 - Goal 5.5 Education Deployment And Runtime Smoke

Status: deployed `speakasap-education`; Goal 5.5 remains active; frontend/gateway cutover still blocked

Approval:

- Owner approval from delegated session: deploy `speakasap-education` and run runtime smoke checks only.
- No approval was inferred for frontend/gateway cutover, object deletion, merge-worker execution, or legacy route retirement.

Session context:

- Required orchestrator files were read from the remote authoritative repo where present.
- `docs/orchestrator/IMPLEMENTATION_ORCHESTRATOR.md` and `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md` are referenced by instructions/state but are not present in the remote repo file list for this session; repository evidence and the available orchestrator docs were used.
- RAG lookup failed with curl exit code `6` (`Could not resolve host: docs-rag-microservice.statex-apps.svc.cluster.local`), so repository and runtime evidence were used.
- Remote worktree before deploy contained the expected uncommitted Goal 5.5 changes on `main`.

Deploy evidence:

- Re-ran `education-service` build and lesson-record contract check before deploy:
  - `npm run build` passed.
  - `npm run test:lesson-records` passed.
- Top-level `scripts/deploy.sh` was not used because it applies gateway manifests and restarts all SpeakASAP services.
- Scoped deploy path used only education service resources:
  - built `localhost:5000/speakasap-education:latest` from `education-service/Dockerfile`.
  - pushed digest `sha256:aac37a909b47872e368a733f973d287e00be35136ff10f423c54bd84c3e5350e`.
  - applied only `k8s/services/education-service.yaml`.
  - restarted only `deployment/speakasap-education -n statex-apps`.
- Rollout evidence:
  - `deployment/speakasap-education` successfully rolled out.
  - ready replicas `1/1`, updated replicas `1`.
  - running pod image ID `localhost:5000/speakasap-education@sha256:aac37a909b47872e368a733f973d287e00be35136ff10f423c54bd84c3e5350e`.
  - restart count `0`, pod ready `true`.
  - `/health` returned `{"status":"ok"}`.

Runtime smoke evidence:

- Deployed HTTP smoke report: `/tmp/speakasap-education-runtime-smoke-g5-5.json`.
- Normal auth smoke user login succeeded through `auth-microservice` and mapped to migrated student profile `333`; the token has no teacher profile and no recorded-lesson `StudentAccess` rows.
- Candidate paid and unpaid `StudentAccess` rows exist in target data, but no safe real tokens were available for those users.
- `RECORDS_S3_*` settings are absent from the running `speakasap-education` pod, so valid object presign/download success paths are blocked by runtime configuration.
- Deployed HTTP checks passed for safe non-mutating cases:
  - state without auth: `401 UNAUTHORIZED`.
  - playback without auth: `401 UNAUTHORIZED`.
  - state with invalid token: `401 UNAUTHORIZED`.
  - download missing token: `403 FORBIDDEN`, no permanent URL in response.
  - download invalid token: `401 UNAUTHORIZED`, no permanent URL in response.
  - download token scoped to the wrong lesson: `401 UNAUTHORIZED`, no permanent URL in response.
  - download with syntactically valid scoped media token: `503` because private record storage helper is not configured; no permanent URL in response.
  - authenticated unrelated student state/playback: `403 FORBIDDEN`.
  - authenticated unrelated student presign/commit/merge/delete attempts: `403 FORBIDDEN` before write/delete/merge behavior.

Service-level smoke evidence:

- Deployed-image service-level mock report: `/tmp/speakasap-education-service-level-smoke-g5-5.json`.
- This used the compiled code inside the deployed pod with mocked Prisma/profile/storage dependencies; no network object storage call and no DB write were performed.
- Service-level checks covered blocked teacher/staff branches safely:
  - presign invalid content type: `400 BadRequestException`.
  - presign oversize: `400 BadRequestException`.
  - valid staff presign shape: method `PUT`, expiresIn `900`, deterministic private key, SigV4-style signature present.
  - commit key mismatch: `400 BadRequestException`.
  - commit ETag mismatch: `400 BadRequestException`.
  - commit size mismatch: `400 BadRequestException`.
  - merge remains disabled: `503 ServiceUnavailableException`.
  - delete remains disabled: `409 ConflictException`.
  - mock counters showed `transactions=0` and `partDeletes=0`.

Guardrails preserved:

- No frontend or gateway deployment/cutover was run.
- No merge worker was executed.
- No object deletion or object write was run.
- No legacy route was retired.
- No rollback SQL was executed.
- `git diff --check` passed after deployment/smoke.

Blockers before Goal 5.5 can be closed:

- Obtain safe real tokens for a paid recorded-lesson student, unpaid recorded-lesson student, assigned teacher, unassigned teacher, and staff user; or add an owner-approved non-production token fixture path.
- Configure `RECORDS_S3_HELPER_URL`, `RECORDS_S3_BUCKET`, `RECORDS_S3_ENDPOINT_URL`, `RECORDS_S3_ACCESS_KEY`, `RECORDS_S3_SECRET_KEY`, and region/SSL settings for `speakasap-education` through Vault/ESO before valid runtime presign/download success can be smoked.
- Re-run deployed HTTP smoke for paid/unpaid playback, teacher/staff presign, commit mismatch after authorization, and valid 900-second private SigV4 PUT after the token and storage blockers are resolved.

Next:

- Continue Goal 5.5 by resolving runtime auth-token fixtures and recording-storage env configuration; keep frontend/gateway cutover, merge execution, object deletion, and legacy retirement blocked until separate approval and evidence exist.

## 2026-06-12 - DocsRAG JWT Runtime Wiring Fixed Across SpeakASAP Services

Current focus:

- Owner-selected operational fix: make DocsRAG usable from SpeakASAP runtime pods after the same JWT_TOKEN issue was fixed for AI, RunLayer, and Leads.
- Runtime source changes: Kubernetes ExternalSecret manifests only; no application code, schema, data migration, object storage mutation, frontend cutover, or gateway route behavior change.

Source context:

- Queried DocsRAG through the already-fixed Leads runtime pod; retrieval returned HTTP 200.
- Compared the existing AI/RunLayer/Leads pattern: .env.example documents JWT_TOKEN and ExternalSecret maps secret/prod service property JWT_TOKEN into the Kubernetes secret.
- Confirmed SpeakASAP root .env.example and k8s/external-secret.yaml already had JWT_TOKEN wiring in the current worktree.
- Confirmed live SpeakASAP ExternalSecrets already mapped JWT_TOKEN for root and service secrets, but most running pods were old and did not expose JWT_TOKEN in process env.
- Added durable JWT_TOKEN mapping to service manifests that were missing it: assessment, certification, content, course, financial, notification, payment, salary, and user. Education already had the mapping; api-gateway consumes speakasap-secret.

Validation evidence:

- Before restart, runtime env checks showed JWT_TOKEN missing from speakasap, api-gateway, assessment, certification, content, course, financial, notification, payment, salary, and user; education already reported present.
- Restarted deployments in statex-apps: speakasap, speakasap-api-gateway, assessment, certification, content, course, education, financial, notification, payment, salary, and user.
- Final rollout status passed for all 12 SpeakASAP deployments.
- Final runtime env checks reported JWT_TOKEN present for speakasap, api-gateway, assessment, certification, content, course, education, notification, payment, salary, and user; financial pod was separately checked and reported JWT_TOKEN_PRESENT with PORT=4213.
- Public health passed: https://speakasap.alfares.cz/health returned {"status":"ok"}.
- DocsRAG retrieval from deployment/speakasap using Node fetch returned HTTP 200 for query Speak ASAP operational constraints.
- Sensitive-data handling: token values were never printed or copied; only presence and HTTP status were recorded.

Gate decision:

- DocsRAG credential blocker is resolved for SpeakASAP runtime pods. Future RAG queries should run from an in-cluster runtime pod or other trusted in-cluster client; a plain SSH shell is not expected to expose runtime secrets.

Next:

- Continue Goal 5.5 by resolving safe real role tokens and RECORDS_S3_* runtime configuration before success-path private media smoke or frontend/gateway cutover.

## 2026-06-12 - Goal 5.5 Runtime Smoke Continued After DocsRAG JWT Fix

Current focus:

- Continued SpeakASAP Goal 5.5 on alfares after DocsRAG JWT became available from runtime pods.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 using JWT_TOKEN without printing token values.
- Source/deploy work stayed remote-only in /home/ssf/Documents/Github/speakasap.

Changes deployed:

- Updated education-service staff access detection to accept scoped auth roles such as global:superadmin in addition to staff/admin/manager/superadmin.
- Updated lesson-record runtime contract verifier to assert the superadmin staff access mapping.
- Rebuilt and pushed localhost:5000/speakasap-education:latest, then restarted deployment/speakasap-education. Rollout completed successfully.

Validation evidence:

- education-service: node scripts/verify-lesson-record-runtime-contract.js passed.
- education-service: npm run build passed.
- Deployed runtime smoke report: /tmp/speakasap-goal55-runtime-smoke-20260612-v3.json.
- Smoke used short-lived in-memory JWTs signed inside the auth pod; token values and presigned URLs were not printed.
- Auth validation for the staff candidate returned role global:superadmin, explaining the previous staff authorization mismatch.
- Staff paths now pass authorization:
  - staff presign valid: 201 with private SigV4 PUT shape and no permanent URL.
  - staff commit key mismatch: 400 before object mutation.
  - staff merge disabled: 503 target merge worker not implemented.
  - staff delete disabled: 409 deletion disabled until owner-approved object deletion exists.
- Existing paid/unpaid/teacher checks remained aligned:
  - no auth and invalid token rejected.
  - paid student state/playback metadata returned 200 with gateway-download tokenized URL and no permanent URL.
  - unpaid student playback denied with 403.
  - assigned teacher presign valid returned 201; unassigned teacher presign denied with 403.

Remaining blocker:

- Paid student tokenized range download returns 404 in the deployed smoke. Earlier diagnostics showed RECORDS_S3_HELPER_URL resolves to localhost in the education pod and no records_s3_helper is running there; the current remote source also contains a dirty storage.service.ts change that attempts localhost-helper fallback via presigned S3 streaming, but the selected existing record object is still not retrievable.
- Do not close Goal 5.5 until playback download is proven against an owner-approved existing object or a safe uploaded fixture, with no permanent URL exposure.

Next:

- Resolve the private media playback object/helper path for speakasap-education, then rerun /tmp/speakasap_goal55_runtime_smoke.js and record a 200 or 206 tokenized download result before frontend/gateway cutover.

## 2026-06-13 - Goal 5.5 Playback Smoke Unblocked

Current focus:

- Continued Goal 5.5 private lesson-record playback verification on alfares.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 with runtime JWT_TOKEN; token values were not printed.

Root cause fixed:

- speakasap-education-secret had RECORDS_S3_ACCESS_KEY set to the MinIO root user but RECORDS_S3_SECRET_KEY did not match the MinIO root password.
- Updated k8s/services/education-service.yaml so RECORDS_S3_SECRET_KEY maps from Vault key secret/prod/minio-microservice, property MINIO_ROOT_PASSWORD.
- Applied the education manifest, forced ExternalSecret refresh, verified secret fingerprints matched without printing secret values, and restarted deployment/speakasap-education.

Validation evidence:

- New education pod reports the corrected secret fingerprint matching MinIO; no secret value was printed.
- Direct deployed S3 probe for existing key shape YYYY/MM/DD/lesson_UUID.mp3 returned 206 audio/mpeg, Content-Range: bytes 0-31/11173841.
- Sanitized deployed smoke report: /tmp/speakasap-goal55-runtime-smoke-20260613-v5.json.
- v5 smoke used short-lived in-memory JWTs signed inside the auth pod; token values and presigned URLs were not printed.
- Paid student playback success path now passes:
  - state: 200 ready.
  - playback metadata: 200, mode gateway-download, tokenized URL, no permanent URL.
  - tokenized range download: 206 audio/mpeg, no permanent URL.
- Access controls still hold:
  - no auth and invalid token rejected with 401.
  - unpaid student playback denied with 403.
  - unassigned teacher presign denied with 403.
  - assigned teacher presign returns 201 private SigV4 PUT shape.
  - commit key mismatch returns 400 before mutation.
  - merge remains disabled with 503; delete remains disabled with 409.

Gate decision:

- Goal 5.5 private playback, paid access, denied access, teacher/staff presign, commit mismatch, merge-disabled, and delete-disabled runtime checks are now validated against deployed services.
- Frontend/gateway cutover, merge worker execution, object deletion, and legacy retirement remain blocked until owner-selected follow-up scope.

Next:

- Prepare the next owner-approved Goal 5 follow-up: frontend/gateway integration or merge/delete implementation scope, without changing legacy routing yet.


## 2026-06-13 - Goal 5 Follow-up Gateway Integration And Merge/Delete Confirmation Gates

Current focus:

- Owner approved merging the Goal 5 follow-up work and proceeding with frontend/gateway integration.
- Checked the coordinator-maintained Active Agents marker before continuing; AGENTS.md still reports None.
- Work stayed remote-only in /home/ssf/Documents/Github/speakasap.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 for the Goal 5 follow-up query after pod-side JWT expansion was corrected; token values were not printed.

Changes deployed:

- api-gateway now streams proxied upstream bodies instead of buffering media responses, preserving range/media behavior for lesson-record downloads.
- api-gateway auth guard now allows unauthenticated GET /api/v1/lessons/:lessonUuid/record/download when the scoped media token is present in the query string; other lesson-record routes still require bearer auth.
- education-service now includes S3 object helpers for merge/delete storage operations and explicit confirmation gates for destructive operations: confirmMerge and confirmDelete must match the lesson UUID before execution.
- frontend learner and teacher pages now call gateway lesson-record endpoints for state, playback, tokenized range checks, teacher/staff presign, merge, and delete; teacher merge/delete send the explicit confirmation body.
- Rebuilt and pushed localhost:5000/speakasap-education:latest digest sha256:776f5086ccf2d578f4de84ac34b7bde7a051890ac0c26287471e78842d6371f1.
- Rebuilt and pushed localhost:5000/speakasap-api-gateway:latest digest sha256:d5568fd64226473d7474089030104bb3161b8d2803993ded799e530db3ac9763.
- Applied education and api-gateway manifests and restarted deployment/speakasap-education and deployment/speakasap-api-gateway; both rollouts completed successfully.

Validation evidence:

- education-service: npm run test:lesson-records passed.
- education-service: npm run build passed.
- api-gateway: npm run build passed.
- frontend: npm run build passed. No frontend Dockerfile or Kubernetes frontend deploy target was found in this repository, so frontend code is built but not deployed from this repo.
- Gateway smoke report: /tmp/speakasap-goal55-gateway-smoke-20260613-v2.json.
- v2 smoke used short-lived in-memory JWTs signed inside the auth pod; token values and presigned URLs were not printed.
- Gateway smoke passed auth and access-control checks: no auth 401, invalid token 401, paid state/playback 200, unpaid playback 403, unassigned teacher presign 403, teacher/staff presign 201, commit key mismatch 400, delete without confirmDelete 400.
- Gateway smoke confirms no permanent URL exposure in response summaries.

Important incident and blocker:

- Earlier gateway smoke report /tmp/speakasap-goal55-gateway-smoke-20260613-v1.json used stale delete-disabled expectations after delete had been enabled in the first deployment attempt and deleted the paid fixture metadata/object for lesson 7d870263-bdcb-4bba-b25e-1f6b40402411.
- The lesson-record metadata was restored by Prisma upsert to uuid 8c0da4cd-5a21-4e8a-bcc9-d137ec80adab and key 2018/07/10/lesson_7d870263-bdcb-4bba-b25e-1f6b40402411.mp3.
- The object itself is still missing: the post-redeploy gateway range check returns 404 for paid_student_token_download_range, while playback metadata still returns 200 and issues a tokenized URL.
- No exact source MP3 was found under /home/ssf/Documents/Github, and no replacement audio was fabricated. Restoring the original object or selecting/uploading an owner-approved fixture is required before closing this follow-up.

Gate decision:

- Backend gateway integration and confirmation-gated merge/delete code are deployed.
- Frontend gateway integration code builds but is not deployed from this repository because no frontend deploy target exists here.
- Goal 5 cannot be closed after this follow-up until the missing paid fixture object is restored and gateway tokenized range download returns 206 again.

Next:

- Restore the original paid fixture object or provide an owner-approved safe replacement fixture, then rerun gateway smoke and update the evidence before any commit or cutover.


Focused fresh-fixture addendum:

- Read-only candidate search found ready lesson d7d708dc-8c89-496f-a5b6-af30ed6db104 with an existing private object; the check read only bytes 0-31.
- Focused deployed gateway smoke report /tmp/speakasap-goal55-focused-gateway-smoke-20260613-v1.json verified staff playback 200 with gateway-download tokenized URL, gateway range download 206 audio/mpeg with Content-Range bytes 0-31/7407935 and 32 bytes, already-ready merge idempotent noop, and delete without confirmDelete blocked with 400.
- This focused smoke is the current successful media playback evidence while the older paid fixture object remains missing.


## 2026-06-13 - Goal 5 Gateway Smoke Restored After Owner-Approved Fixture Replacement

Current focus:

- Owner approved restoring the missing paid lesson recording with an approved replacement fixture so Goal 5 gateway validation could continue.
- Checked AGENTS.md before proceeding; Active Agents still reported None.

Restoration:

- Used legacy portal fixture /home/ssf/Documents/Github/speakasap-portal/education/lesson_records/tests/example.mp3 as the owner-approved replacement audio.
- Uploaded it through the running speakasap-education pod to the original private object key 2018/07/10/lesson_7d870263-bdcb-4bba-b25e-1f6b40402411.mp3, preserving the target lesson-record metadata and gateway URL shape.
- The custom follow-up HEAD helper returned a generic metadata check failure, so validation used the production gateway playback/download path instead.

Validation evidence:

- Gateway smoke report: /tmp/speakasap-goal55-gateway-smoke-20260613-v5.json.
- v5 smoke used short-lived in-memory JWTs signed inside the auth pod; token values and presigned URLs were not printed.
- Paid student state/playback metadata returned 200/200 with gateway-download tokenized URL and no permanent URL.
- Paid student tokenized range download returned 206 audio/mpeg with 32-byte range body and no permanent URL.
- Access controls still hold: no auth 401, invalid token 401, unpaid playback 403, unassigned teacher presign 403, teacher/staff presign 201, commit key mismatch 400, already-ready merge noop 201, delete without confirmDelete 400.

Gate decision:

- The prior missing-object blocker is resolved with owner-approved replacement fixture evidence.
- Backend gateway integration and confirmation-gated merge/delete are deployed and smoke-validated.
- Frontend gateway integration code builds, but no frontend deployment target exists in this repository.

Next:

- Prepare the intent-preservation commit or locate the frontend deployment path before cutover, keeping confirmed destructive merge/delete usage out of smoke tests unless explicitly scoped.


## 2026-06-13 - Goal 6 Frontend Deployment Path Discovery

Current focus:

- Owner requested locating the frontend deployment path before cutover and clarified it should be in the same remote/server context.
- Checked AGENTS.md before discovery; Active Agents reported None.
- Discovery was read-only against /home/ssf/Documents/Github/speakasap, sibling deployment examples, and Kubernetes state.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 for the frontend deployment path query; token values were not printed.

Located source and live route:

- Frontend source path exists in this repository: /home/ssf/Documents/Github/speakasap/frontend.
- The frontend is a Next.js app with package scripts dev/build/start in frontend/package.json.
- Public host speakasap.alfares.cz routes through ingress speakasap to service speakasap port 3000.
- The live root deployment is deployment/speakasap in namespace statex-apps using image localhost:5000/speakasap:latest.

Deployment gap:

- Root Dockerfile currently builds api-gateway from api-gateway/package*.json and api-gateway/src, not frontend/.
- The running speakasap pod contains an api-gateway package and returns Express JSON 404 for GET /; it is not serving the Next frontend.
- No speakasap-frontend deployment, service, ingress, frontend Dockerfile, or deploy-frontend script exists in the SpeakASAP repository.
- Sibling repositories show the expected pattern for frontend deployment: a dedicated frontend image, deployment, service, and deploy script. SpeakASAP has not implemented that path yet.

Cutover implication:

- The frontend deployment path is only partially present: source is /home/ssf/Documents/Github/speakasap/frontend, and the public route currently points at deployment/speakasap, but that deployment image is not the frontend.
- Before cutover, create or adapt a frontend deployment path for the Next app, then decide whether speakasap.alfares.cz should route directly to a frontend service or whether the root speakasap image should be rebuilt to contain the frontend.

Next:

- Implement the missing SpeakASAP frontend deployment path: Dockerfile for frontend, Kubernetes deployment/service and ingress routing decision, deploy script, build/rollout/smoke evidence.
## 2026-06-13 - Goal 6.1 Frontend Deployment Path Implemented

Status: done for deployment path and smoke evidence

Changed:

- Added `frontend/Dockerfile` for a Next.js standalone production image on port `4211`.
- Enabled `output: "standalone"` in `frontend/next.config.ts`.
- Added `k8s/services/frontend.yaml` with `speakasap-frontend` Deployment, Service, and ConfigMap.
- Updated `k8s/ingress.yaml` to route `/health` and `/api` to `speakasap-api-gateway:4210`, and `/` to `speakasap-frontend:4211`.
- Added `scripts/deploy-frontend.sh` as the scoped deploy command for build, push, manifest apply, rollout, and smoke checks.
- Added `speakasap-frontend` to the full-platform rollout list in `scripts/deploy.sh`.
- Added `docs/orchestrator/FRONTEND_DEPLOYMENT_PATH.md` with routing decision, deploy command, rollback, and smoke evidence.

Evidence:

- RAG query for frontend deployment context failed with curl exit code 6, so repository/runtime evidence was used.
- `cd frontend && npm run build` passed before deployment.
- `./scripts/deploy-frontend.sh` built and pushed `localhost:5000/speakasap-frontend:latest` with digest `sha256:97b3d7069530433ee65b165e5f0c33ba31acd79525939a5b4296d9973f3d35e8`.
- `deployment/speakasap-frontend` rolled out successfully in `statex-apps`; final pod `speakasap-frontend-788dbfc4b5-9s66h` was `1/1 Running` with `0` restarts.
- Ingress evidence after deploy: `/health -> speakasap-api-gateway:4210`, `/api -> speakasap-api-gateway:4210`, `/ -> speakasap-frontend:4211`.
- Public smoke: `https://speakasap.alfares.cz/` returned `HTTP/2 200` with `content-type: text/html; charset=utf-8` and `x-powered-by: Next.js`.
- Gateway health smoke: `https://speakasap.alfares.cz/health` returned `HTTP/2 200` with Express JSON headers.
- Protected API smoke: `https://speakasap.alfares.cz/api/v1/lessons` returned `HTTP/2 401`, confirming gateway auth remains enforced for protected routes.

Boundaries:

- No database writes, object-storage mutation, lesson-record rerun, rollback execution, legacy retirement, or payment/notification ownership change was performed.
- Frontend browser API ownership remains gateway-first; service-owned APIs still route through `speakasap-api-gateway`.
- Docker build reported existing frontend dependency audit findings: `3 vulnerabilities (2 moderate, 1 high)`; remediation is deferred to a dependency/security chunk.

Next:

- Continue Goal 6 by implementing or verifying frontend routes for selected migrated workflows, starting with lesson-recording playback/upload UX against the gateway contracts.
## 2026-06-13 - Goal 6.2 Frontend Routes For Lesson Recording

Status: done for unauthenticated/dummy-token route implementation and rendered verification

Changed:

- Added shared `LessonRecordWorkspace` client component for learner/teacher lesson-recording route checks.
- Added `/learner/lessons/[lessonUuid]/record` and `/teacher/lessons/[lessonUuid]/record`.
- Updated `/learner` and `/teacher` shell pages to open the dynamic lesson-record route for a supplied lesson UUID.
- Hardened `frontend/lib/api-client.ts` so gateway calls normalize relative paths and tolerate absolute scoped URLs.
- Removed direct clickable merge/delete behavior from the route UI; destructive actions are explicitly excluded from frontend verification controls.
- Fixed mobile horizontal overflow found during browser QA.
- Updated `scripts/deploy-frontend.sh` with retrying smoke checks because immediate Cloudflare/root smoke can transiently return `502` during endpoint propagation.
- Added `docs/orchestrator/FRONTEND_ROUTE_VERIFICATION.md`.

Evidence:

- RAG query failed with curl exit code 6, so repository/runtime evidence was used.
- `cd frontend && npm run build` passed and listed dynamic routes `/learner/lessons/[lessonUuid]/record` and `/teacher/lessons/[lessonUuid]/record`.
- Final deployed frontend image digest: `sha256:d1c0c00fb01cf82a1355b72dc8ddedc5c2aec0c1d1cd910fadf68937e09ef402`.
- Final frontend pod `speakasap-frontend-868bcd6458-zwh5l` was `1/1 Running`, restarts `0`; logs showed Next.js ready.
- Delayed public smoke after rollout returned `HTTP/2 200` for `/`, `/learner/lessons/test-lesson/record`, and `/teacher/lessons/test-lesson/record`.
- Protected gateway smoke returned `HTTP/2 401` for `/api/v1/lessons/test-lesson/record`.
- Browser QA desktop learner route: page identity matched, rendered nonblank, console errors/warnings empty, missing-token validation appeared, and dummy-token gateway state check returned `401 Invalid token`.
- Browser QA desktop teacher route: page identity matched, rendered nonblank, console errors/warnings empty, upload presign control rendered, destructive-action exclusion note rendered, and dummy-token presign returned `401 Invalid token`.
- Browser QA mobile `390x844`: initial horizontal clipping was found and fixed; recheck rendered without clipping and with no console errors/warnings.

Boundaries:

- No real user token was used in browser QA.
- No database writes, object-storage mutation, upload, commit, merge, delete, rollback execution, legacy retirement, or payment/notification ownership change was performed.
- Frontend still calls the API gateway only; education-service remains behind `speakasap-api-gateway`.

Next:

- Continue Goal 6 with authorized frontend parity checks when fresh learner/teacher/staff JWTs are available, or move to broader protected route parity cases if owner provides test credentials.


## 2026-06-13 - Goal 6.3 Authorized Frontend Lesson-Recording Parity Checks

Status: done for authorized learner/teacher/staff frontend parity checks

Current focus:

- Ran authorized rendered frontend checks for migrated lesson-recording workflows after fresh short-lived JWTs were generated inside the auth runtime.
- Work stayed remote-only against `/home/ssf/Documents/Github/speakasap`; no local Documents source edits were made.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 for the Goal 6.3 context query; token values were not printed.

Validation evidence:

- Sanitized browser report: `/tmp/speakasap-goal63-frontend-parity-browser-report.json`.
- Redacted screenshots: `/tmp/speakasap-goal63-learner-paid-state.png`, `/tmp/speakasap-goal63-learner-unpaid-denied.png`, `/tmp/speakasap-goal63-teacher-unassigned-denied.png`.
- Browser route identity/nonblank checks passed for:
  - `https://speakasap.alfares.cz/learner/lessons/7d870263-bdcb-4bba-b25e-1f6b40402411/record`
  - `https://speakasap.alfares.cz/learner/lessons/852c4cdd-9c44-47e4-b57f-e101ae9f3f0a/record`
  - `https://speakasap.alfares.cz/teacher/lessons/7d870263-bdcb-4bba-b25e-1f6b40402411/record`
- Console warning/error count was `0`; no framework overlay was present.
- Paid learner state returned `200` with `state=ready` and no permanent URL.
- Paid learner playback returned `200`, `mode=gateway-download`, `method=GET`, `expiresIn=3600`, and a scoped tokenized URL; sanitized range verification returned `206 audio/mpeg` for 32 bytes.
- Unpaid learner playback returned `403 FORBIDDEN` with `Lesson record access denied`.
- Assigned teacher presign returned `201`, `method=PUT`, `expiresIn=900`, private key prefix `2018/07/10`, MinIO host, and SigV4 signature present.
- Unassigned teacher presign returned `403 FORBIDDEN` with `Assigned teacher or staff access required`.
- Staff presign returned `201`, `method=PUT`, `expiresIn=900`, private key prefix `2018/07/10`, MinIO host, and SigV4 signature present.
- Report and screenshots are sanitized: JWT values, scoped media tokens, and signed URLs are omitted or redacted.

Boundaries:

- No code changes, deployment, database write, object-storage mutation, upload PUT, commit, merge, delete, rollback execution, legacy retirement, payment change, or notification delivery change was performed.
- Frontend calls stayed gateway-first; private media remained behind scoped tokenized gateway download or short-lived SigV4 PUT presign.

Gate decision:

- Goal 6 authorized frontend parity for the migrated lesson-recording workflow is complete for the selected learner, teacher, and staff cases.
- Cutover is not approved by this check; Goal 7 still needs operational cutover readiness, rollback/runbook, manifests/secrets/health/logging review, and owner approval before any legacy traffic retirement.

Next:

- Start Goal 7 operational cutover readiness: verify Kubernetes manifests, secrets, health checks, logging, smoke URLs, and rollback/cutover runbook for the lesson-recording path before any cutover approval.


## 2026-06-13 - Goal 7.1 Operational Cutover Readiness

Status: done for readiness evidence and runbook; cutover not approved or executed

Current focus:

- Prepared operational cutover readiness for the migrated lesson-recording workflow.
- Work stayed remote-only in `/home/ssf/Documents/Github/speakasap`.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 for the Goal 7.1 context query; token values were not printed.

Changed:

- Added `docs/orchestrator/GOAL_7_CUTOVER_READINESS.md` with scope, ownership boundaries, live evidence, public smoke URLs, secret/runtime checks, logging/events, cutover checklist, post-cutover smoke list, rollback commands, and approval gate.

Validation evidence:

- Operational report: `/tmp/speakasap-goal7-operational-readiness.json`.
- Affected deployments rolled out successfully: `speakasap-frontend`, `speakasap-api-gateway`, and `speakasap-education`.
- Current pods are `1/1 Running` with `0` restarts for the affected deployments.
- Current image digests:
  - frontend `sha256:d1c0c00fb01cf82a1355b72dc8ddedc5c2aec0c1d1cd910fadf68937e09ef402`
  - api-gateway `sha256:d5568fd64226473d7474089030104bb3161b8d2803993ded799e530db3ac9763`
  - education `sha256:776f5086ccf2d578f4de84ac34b7bde7a051890ac0c26287471e78842d6371f1`
- Ingress routing verified: `/health` and `/api` route to `speakasap-api-gateway:4210`; `/` routes to `speakasap-frontend:4211`.
- ExternalSecrets `speakasap-education-secret` and `speakasap-secret` are `SecretSynced=True`; required key names are present without printing values.
- Public smoke results:
  - `/` -> `200 text/html; charset=utf-8`
  - `/health` -> `200 application/json; charset=utf-8`
  - protected record API without bearer -> `401 application/json; charset=utf-8`
  - learner record route -> `200 text/html; charset=utf-8`
  - teacher record route -> `200 text/html; charset=utf-8`
- Sampled logs from frontend, api-gateway, and education had `0` warning/error/exception/fatal matches.
- Runtime OpenSSL versions are 3.x: frontend `3.5.5`, api-gateway `3.5.5`, education `3.5.4`.
- SpeakASAP-specific events show normal frontend rollout activity plus one transient readiness probe failure on an old frontend pod during replacement; current affected pods are ready.

Boundaries:

- No cutover, legacy retirement, DNS change, deployment, database write, object-storage mutation, upload PUT, commit, merge, delete, rollback execution, payment change, or notification delivery change was performed.
- Cutover remains blocked until owner approval records exact traffic/legacy-route change, rollback window, monitoring commands, acceptance smoke list, date, and approver.

Gate decision:

- Goal 7 operational cutover readiness is complete for the selected lesson-recording workflow.
- Goal 8 controlled cutover and legacy decommission is owner-approval gated.

Next:

- Request explicit owner approval for the exact Goal 8 cutover action, rollback window, monitoring plan, and acceptance smoke list before changing traffic or retiring legacy routes.


## 2026-06-13 - Goal 8.1 Controlled Cutover Validation

Status: done for controlled cutover validation; legacy freeze/decommission not executed

Approval:

- Owner approved continuation in the Codex thread on 2026-06-13: `You have my approval. Continue.`
- Approval was applied to the Goal 8 controlled cutover validation for the already-routed migrated lesson-recording workflow on `https://speakasap.alfares.cz`.
- No approval was inferred for destructive operations, object deletion, migration reruns, legacy shutdown, DNS change, or irreversible decommission.

Changed:

- Added `docs/orchestrator/GOAL_8_CONTROLLED_CUTOVER.md` with approval record, cutover action, smoke evidence, monitoring evidence, rollback availability, and legacy freeze/decommission gate.

Validation evidence:

- Cutover smoke report: `/tmp/speakasap-goal8-cutover-smoke.json`.
- Cutover monitoring report: `/tmp/speakasap-goal8-cutover-monitoring.json`.
- Public smoke after approval:
  - root -> `200 text/html; charset=utf-8`
  - health -> `200 application/json; charset=utf-8`
  - learner route -> `200 text/html; charset=utf-8`
  - teacher route -> `200 text/html; charset=utf-8`
- Authenticated workflow smoke used fresh short-lived JWTs generated inside the auth runtime; token values were not printed.
- Workflow smoke passed expected statuses: no-auth state `401`, paid learner state `200`, paid learner playback `200`, tokenized range download `206`, unpaid playback denial `403`, assigned teacher presign `201`, unassigned teacher presign `403`, staff presign `201`, delete without confirmation `400`.
- No checked response exposed a permanent public recording URL.
- Affected deployments remained rolled out: `speakasap-frontend`, `speakasap-api-gateway`, and `speakasap-education`.
- Current affected pods remained `1/1 Running` with `0` restarts.
- Last-hour log scan for warning/error/exception/fatal terms returned `0` matches for frontend, api-gateway, and education.

Boundaries:

- No traffic change was required because ingress already routed the migrated frontend/gateway path.
- No deployment, database write, object-storage mutation, upload PUT, commit, merge, delete, rollback execution, legacy route freeze, DNS change, payment change, or notification delivery change was performed.
- Legacy portal remains available as rollback/reference.

Gate decision:

- Controlled cutover validation for the migrated lesson-recording workflow is clean.
- Goal 8 remains active for a separate owner-selected legacy freeze/decommission target because no exact legacy route, DNS target, nginx rule, feature flag, or repository path was named for freeze.

Next:

- Select the exact reversible legacy freeze/decommission target for lesson recordings, or close the migration wave with legacy retained as rollback/reference until a later owner-approved retirement window.


## 2026-06-13 - Goal 8 Legacy Fallback Decision And Goal 9 Salary Migration Setup

Status: Goal 8 closed with legacy retained as fallback; Goal 9 salary migration created

Owner direction:

- Keep the legacy lesson-recording path available as fallback/reference if the new service is not running or a migrated workflow regresses.
- Start the next migration target: salary, because teacher salary/payments depend on lesson-recording duration once a lesson is recorded and saved.

Legacy salary evidence reviewed:

- `speakasap-portal/education/lesson_records/models.py`: `LessonRecord.get_record_length()` reads MP3 duration through `mutagen.mp3.MP3` from local or storage-backed file.
- `speakasap-portal/expenses/salary/utils.py`: `get_record_length_in_hours()` implements demo/no-record/record-unavailable fallback, 95% full-lesson threshold, scheduled-duration cap, and quantization; `get_real_lessons_duration()` sums recording-derived hours for finished lessons.
- `speakasap-portal/expenses/signals/handlers.py`: lesson finish creates `LessonSalaryExpense`; lesson-record update calls `check_lesson_expense()` to sync salary quantity.
- `speakasap-portal/expenses/tasks.py`: monthly `calculate_salary()` creates salary rows from real recording-derived duration, hourly rates, fixed salary, and lower/upper work-duration bounds.
- `speakasap-portal/expenses/management/commands/add_lessons_to_expenses.py`: monthly/teacher backfill updates missing or stale lesson salary expenses.
- `speakasap-portal/administrator/views/salary.py`: admin salary list/detail views aggregate teacher/other profiles, totals, subtotals, and expected vs real lesson duration.
- `speakasap-portal/expenses/tests/test_common.py`: legacy tests show finished lessons create salary expenses; example MP3 changes qty from `0` to `0.01`; only finished lessons are included by backfill/check commands.

Target evidence reviewed:

- `salary-service/prisma/schema.prisma` already has salary profiles, salary expenses, calculation runs, payout runs, and payout lines.
- `salary-service/scripts/migrate-salary-data.ts` already reads legacy salary profiles/expenses and has dry-run/load modes, but needs updated reconciliation gates for recording-duration parity and payment safety.
- `salary-service/src/calculation-runs/calculation-runs.service.ts` already depends on `EducationClientService.fetchPeriodAggregates()`.
- `salary-service/src/deps/education-client.service.ts` expects `/api/v1/internal/salary/period-aggregates`, but education-service does not yet expose it.
- `education-service` migrated lesson records store private object keys/state, but `LessonRecordsService.getState()` still returns `durationSeconds: null` and no persisted MP3 duration exists yet.

Changed:

- Added `docs/orchestrator/SALARY_MIGRATION_GOAL.md`.
- Updated roadmap/state to make Goal 9 the active migration target.
- Goal 8 remains complete for controlled cutover validation with legacy retained as fallback/reference; no freeze/decommission was executed.

Boundaries:

- No code changes, database writes, salary calculations, payout creation, payment execution, object-storage mutation, deployment, rollback, or legacy retirement were performed.
- Future salary work must stay dry-run/reconciliation-first and cannot bypass `payments-microservice` for real payouts.

Next:

- Goal 9.1: create `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` with source-to-target salary mapping, recording-duration payroll parity rules, education aggregate contract, dry-run report format, and verification commands.

## 2026-06-13 - Salary Migration Deploy And CLI

Status: deployed internal salary dependencies and added read-only salary CLI; payout/calculation flows not executed

Approval:

- Owner approved deployment and CLI continuation in the Codex thread on 2026-06-13: `I approve. Go ahead, deploy, and proceed with the next step with the implementation of the CLI.`

Changed:

- Deployed `speakasap-user` with the internal teacher legacy-user mapping endpoint.
- Deployed `speakasap-education` with the internal salary period aggregate endpoint.
- Added `salary-service` CLI script `npm run salary:cli -- ...` for read-only target salary database inspection.
- Updated `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` with deployed aggregate status and salary CLI verification commands.

Deployment evidence:

- Built and pushed `localhost:5000/speakasap-user:latest` and `localhost:5000/speakasap-education:latest`.
- Applied `k8s/services/user-service.yaml` and `k8s/services/education-service.yaml` in namespace `statex-apps`.
- Rollouts completed for deployments `speakasap-user` and `speakasap-education`.
- Health checks returned `{"status":"ok"}` for both services.
- Internal salary aggregate smoke returned valid JSON for period `2026-05`; sampled legacy user had warning `no_teacher_mapping_for_requested_legacy_users`.

CLI verification evidence:

- `cd salary-service && npm run salary:cli -- --help` passed.
- `cd salary-service && npm run build` passed.
- Against the existing Kubernetes Postgres service through temporary remote port-forward `127.0.0.1:15434`, `npm run salary:cli -- status --json-report /tmp/speakasap-salary-cli-status-v1.json` returned read-only counts: salary profiles `386`, salary expenses `103983`, employee contracts `632`, calculation runs `0`, payout runs `0`, imported lesson expenses `98753`, imported support bonuses `176`.
- Status warnings are expected for current migration state: all `386` profiles lack `authUserId`, and all `98753` lesson salary expenses lack `lessonUuid`.
- `npm run salary:cli -- period-summary --period 2026-05 --json-report /tmp/speakasap-salary-cli-period-2026-05-v1.json` returned grouped totals for CZK/EUR generic and lesson rows.
- Temporary port-forward was stopped and `15434` had no remaining listener.

Boundaries:

- No salary calculation run, payout run, payment-service disbursement, object-storage mutation, source legacy mutation, rollback execution, merge, or destructive cleanup was performed.
- The CLI is read-only by implementation and only reports existing target salary database state.

Next:

- Implement auth legacy identity mapping resolution for salary profiles, then backfill lesson UUID references for imported lesson salary expenses once the education lesson mapping is available.

## 2026-06-13 - Salary Profile Auth Mapping

Status: done; imported salary profiles now resolve to target auth user IDs

Approval:

- Owner approved continuing the next salary implementation step in the Codex thread on 2026-06-13: `Agree, go ahead.`

Changed:

- Enhanced `salary-service/scripts/migrate-salary-data.ts` to load `legacy_portal_user_id -> auth_user_id` from `user-service.user_identity_mirror` using `USER_DATABASE_URL`.
- Future profile imports now set `SalaryProfile.authUserId` when a migrated user identity mirror exists.
- Added `--auth-map-only` write mode so existing salary profiles can be updated without creating salary expenses, employee contracts, calculation runs, payout runs, or payment disbursements.
- Added auth-specific rollback SQL generation that only nulls `salary_profiles.auth_user_id` for imported salary profiles.
- Updated `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` to close the salary profile auth mapping gap.

Verification evidence:

- RAG retrieval was skipped because `JWT_TOKEN` was unavailable in the remote shell; repository evidence was used instead.
- `cd salary-service && npm run build` passed after implementation.
- `cd salary-service && npm run migrate:salary-data -- --help` passed and showed `--auth-map-only`.
- Dry-run report `/tmp/speakasap-salary-auth-map-dry-run-v1.json` resolved `386/386` salary profile legacy users from `user_identity_mirror`, with `profiles_missing_auth_uuid.count=0`.
- First auth-only apply attempt wrote `/tmp/speakasap-salary-auth-map-apply-v1.json` but stopped before writes because the auth rollback helper was missing; no `profile_auth_users_updated` log occurred.
- Second auth-only apply report `/tmp/speakasap-salary-auth-map-apply-v2.json` completed with `authProfilesUpdated=386`.
- Auth rollback SQL: `/tmp/speakasap-salary-auth-map-rollback-v1.sql`; it only sets imported salary profile `auth_user_id` values back to null.
- Post-apply read-only CLI report `/tmp/speakasap-salary-cli-status-after-auth-map-v1.json` returned `profilesWithoutAuth=0`, `salaryProfiles=386`, `salaryExpenses=103983`, `employeeContracts=632`, `calculationRuns=0`, and `payoutRuns=0`.
- Temporary Postgres port-forward was stopped; remote `15434` had no remaining listener.

Boundaries:

- No salary calculation run, payout run, payment-service disbursement, salary expense creation, employee contract creation, legacy source mutation, object-storage mutation, deployment, rollback execution, or destructive cleanup was performed.
- Remaining migration warning is expected: `98753` imported lesson salary expenses still have null `lessonUuid` until education lesson UUID backfill is implemented.

Next:

- Implement salary lesson UUID backfill by mapping legacy lesson salary expense lesson IDs to target education lesson UUIDs, then rerun read-only reconciliation before any salary calculation or payout flow.


## 2026-06-13 - Goal 10.1 Worker 10.1 Seven Content Schema/API Contract

Status: implemented and statically verified; no data migration write, deployment, frontend change, object mutation, or legacy route retirement ran.

Changed by Worker 10.1:

- Added content-service Prisma schema models for SevenCourse, SevenLesson, and SevenExercise with legacy course/lesson IDs, language relation, material language, metadata, app package, materialsChanged-derived API version support, rendered lesson/exercise/answer HTML fields, and duplicate guards.
- Added content-service public read module under content-service/src/seven for /api/v1/seven/courses, /api/v1/seven/courses/:languageCode, /api/v1/seven/courses/:languageCode/lessons, and /api/v1/seven/courses/:languageCode/lessons/:order.
- Wired SevenModule into content-service AppModule.
- Added api-gateway upstream routing for /api/v1/seven to CONTENT_SERVICE_URL.

Evidence:

- RAG was unavailable in the remote shell because JWT_TOKEN was not set; implementation used repository evidence from the mandatory Goal 10 docs plus legacy seven models/API/views/serializers and existing content-service grammar/languages patterns.
- docs/orchestrator/IMPLEMENTATION_ORCHESTRATOR.md and docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md are referenced by task docs but absent in this remote checkout, so the available intent rules were followed from MASTER_PROMPT.md, INTENT.md, GOALS.md, PLAN.md, TASKS.md, and STATE.json.
- cd content-service && npm run prisma:validate passed.
- cd content-service && npm run prisma:generate passed.
- cd content-service && npm run build passed.
- cd api-gateway && npm run build passed.

Notes:

- Gateway upstream routing now resolves /api/v1/seven to content-service, but api-gateway/src/proxy/gateway-auth.guard.ts still requires bearer auth for general /api/v1 routes. Anonymous gateway access for public seven content remains a separate gateway-auth ownership decision unless the master assigns that file.
- An untracked content-service/prisma/migrations/20260613110000_seven_content/migration.sql directory is present in the shared worktree and matches the seven schema, but Worker 10.1 did not run prisma migrate and did not remove shared untracked work.

Next:

- Goal 10.2: add the dry-run-first legacy seven content importer and reconciliation report without target DB writes.

## 2026-06-13 - Goal 10 Seven Schema/Importer Audit

Status: implemented and verified through no-write evidence; approval gate remains before schema/data writes.

Changed:

- Audited legacy `seven.xml` lesson order assumptions before any schema migration.
- Confirmed `en`, `de`, and `cn` have 8 legacy rows, but no duplicate `(course, order)` values; source order is compatible with the new `SevenLesson(courseId, order)` unique key.
- Updated `content-service/scripts/migrate-seven-from-legacy.py` so exercise files are ordered by parsed lesson/exercise numbers instead of lexicographic filename order.

Verification evidence:

- Numeric order helper returned `(12, 3, lesson12ex3.html)` and `(1, 10, lesson1ex10.html)` for sample filenames.
- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v6.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and 4 expected warnings: media root absent from checkout plus 8-row course warnings for `en`, `de`, and `cn`.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` refused with status `2` because `--confirm-write` was missing; no DB action was attempted.
- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- `cd api-gateway && npm run build` passed.
- `cd frontend && npm run build` passed and included dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Reconciliation Hardening

Status: implemented and verified through no-write evidence; approval gate remains before schema/data writes.

Changed:

- Added migration batch marker `seven-content-legacy-20260613` to course, lesson, and exercise payload metadata.
- Added the same batch note to generated rollback SQL.
- Strengthened DB-backed target reconciliation so reports include planned legacy course ID, lesson ID, and exercise key counts, and target ID samples once the seven tables exist.

Verification evidence:

- `/tmp/speakasap-seven-dry-run-v7.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and 4 expected warnings.
- Sample payload metadata verified batch marker on one course, one lesson, and one exercise.
- `/tmp/speakasap-seven-dry-run-target-v8.json` recorded `writes=false`, `target.checked=true`, planned counts `19/136/429`, and expected missing-table errors for `SevenCourse`, `SevenLesson`, and `SevenExercise` before schema migration.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` refused with status `2` because `--confirm-write` was missing; no DB action was attempted.
- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, deployment, object mutation, destructive operation, or legacy route retirement ran.
- Temporary Postgres port-forward for the read-only target check was stopped.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Frontend Preview Parity

Status: implemented and Browser-verified against a no-write mock gateway; production visual gate remains open until data apply/deploy.

Changed:

- Added frontend/app/components/seven-reading-indicator.tsx for lesson reading progress.
- Added seven promo/PDF helpers in frontend/lib/seven.ts.
- Updated seven course and lesson pages to reuse promo copy, show the lesson PDF link, render a lesson-page course promo block, and include the reading indicator.
- Added CSS for the reading indicator, PDF link area, and lesson-page promo block while preserving legacy typography colors and sizing.

Verification evidence:

- cd frontend && npm run build passed and retained dynamic routes /[languageCode]/seven and /[languageCode]/seven/[order].
- In-app Browser QA used temporary mock gateway 127.0.0.1:4310 and temporary Next preview 127.0.0.1:4311; no target DB, deployment, or object storage writes were run.
- Course page /en/seven rendered two lesson cards, grammar-safe promo text, header font Open Sans Legacy 44px/52.8px, promo text 18px/27.9px/700, no framework overlay, and zero console warnings/errors.
- Lesson page /en/seven/1 rendered PDF link /media/pdf/en/lesson1.pdf, paragraph style 16px/30px/rgb(66, 66, 66), heading style PT Mono 32px/40px/rgb(44, 150, 255), answer disclosure opened, reading indicator reached width: 100% after scroll, no framework overlay, and zero console warnings/errors.
- Screenshots: /tmp/speakasap-seven-course-preview.png and /tmp/speakasap-seven-lesson-preview.png.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Temporary mock gateway, Next preview, and SSH port-forward processes were stopped after QA.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply. Full desktop/mobile production visual QA remains after real data apply and deployment.

## 2026-06-13 - Goal 10 Seven Media Contract

Status: implemented and statically verified; approval gate remains before schema/data writes.

Changed:

- Added `pdfHref` to `content-service` seven lesson summary/detail API payloads using the legacy PDF path shape `/media/pdf/<languageCode>/lesson<order>.pdf`.
- Updated frontend seven lesson types and lesson page to prefer API-provided `pdfHref`, keeping the existing helper as a fallback for mock or older payloads.

Verification evidence:

- `cd content-service && npm run build` passed.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Language Case Metadata

Status: implemented and verified through no-write evidence; approval gate remains before schema/data writes.

Changed:

- Added `legacyLanguageCaseGent` to seven course migration metadata so frontend promo text can use migrated content metadata instead of only a frontend fallback map.
- Completed genitive mappings for all 19 seven course language codes present in legacy `seven.xml`, including legacy codes `se`, `dk`, `sk`, and `ru`.
- Kept frontend fallback mappings aligned with importer mappings.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v10.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and 4 expected warnings.
- Explicit payload audit printed genitive metadata for all 19 courses and `missing []`.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` refused with status `2` because `--confirm-write` was missing; no DB action was attempted.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Lesson Navigation Contract

Status: implemented and statically verified; approval gate remains before schema/data writes.

Changed:

- Added `previousLesson` and `nextLesson` summary objects to `content-service` seven lesson detail payloads.
- Updated frontend lesson page navigation to prefer API-provided adjacent lesson summaries, while preserving the computed fallback for mock or older payloads.

Verification evidence:

- `cd content-service && npm run build` passed.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Next Metadata Parity

Status: implemented and statically verified; approval gate remains before schema/data writes.

Changed:

- Added Next metadata generation to seven course and seven lesson routes so page title, description, keywords, and Open Graph fields come from migrated course/lesson SEO fields when available.
- Kept the existing SpeakASAP default description fallback for unavailable or incomplete seven content.

Verification evidence:

- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Structured Media References

Status: implemented and verified through no-write evidence; approval gate remains before schema/data writes.

Changed:

- Added structured `mediaRefs` extraction to the seven migration payload metadata for lesson, exercise, and answer HTML after static legacy tag rendering.
- Added `migrationMediaRefs` summary counts to the dry-run report so media reconciliation can be checked before apply.
- Added `mediaRefs` to content-service seven lesson/exercise API response types and frontend seven data types, with lesson payloads including the PDF fallback reference.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `cd content-service && npm run build` passed.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.
- `/tmp/speakasap-seven-dry-run-v11.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, `migrationMediaRefs.lessonRowsWithRefs=136`, `migrationMediaRefs.exerciseRowsWithRefs=408`, `migrationMediaRefs.uniqueRefs=1104`, no blocking issues, and 4 expected warnings.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 App Promo Frontend Parity

Status: implemented and statically verified; approval gate remains before schema/data writes.

Changed:

- Added a shared seven app promo component for the legacy visible block: "Полная версия курса ... в бесплатных приложениях для iOS и Android" with the four learner-facing bullet points from the legacy templates.
- Rendered the app promo on both seven course and seven lesson pages when migrated course data has `appPackage`.
- Added restrained CSS for the app promo block using the existing seven typography palette and a green action button.
- Kept iOS URL out of the UI until it is represented by migrated data; the current safe action derives only the Google Play URL from `appPackage`.

Verification evidence:

- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.
- `rg` confirmed `SevenAppPromo` is wired into `frontend/app/[languageCode]/seven/page.tsx` and `frontend/app/[languageCode]/seven/[order]/page.tsx`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Legacy App URL Metadata

Status: implemented and verified through no-write evidence; approval gate remains before schema/data writes.

Changed:

- Extended the seven importer to read legacy `Language.ANDROID_URLS` and `Language.IOS_URLS` from `speakasap-portal/language/models.py` via AST and store `legacyAndroidUrl` / `legacyIosUrl` in course metadata.
- Added `legacyAppUrls` counts to the seven dry-run report so app-link coverage is visible before data apply.
- Updated frontend app promo links to use migrated legacy app URLs from course metadata, falling back to `appPackage` only for Google Play when metadata is missing.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v12.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, `legacyAppUrls.android=18`, `legacyAppUrls.ios=17`, `courseRowsWithAndroidUrl=18`, `courseRowsWithIosUrl=17`, no blocking issues, and 4 expected warnings.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 App Promo Rendered QA

Status: Browser-verified against temporary mock data; approval gate remains before schema/data writes.

Rendered QA environment:

- Temporary mock gateway: remote `127.0.0.1:4320`.
- Temporary Next preview: remote `127.0.0.1:4321`, forwarded to local `http://127.0.0.1:4321`.
- Browser plugin path: in-app Browser; desktop viewport width reported as `1280`.
- Mobile viewport check was attempted but Browser runtime did not expose `setViewportSize`, so mobile app-promo QA remains for the post-data/deploy visual pass.

Verification evidence:

- `/en/seven` rendered the app promo with heading `Полная версия курса «Английский язык за 7 уроков» в бесплатных приложениях для iOS и Android`.
- `/en/seven` exposed both legacy app links: Google Play `https://play.google.com/store/apps/details?id=ru.ookamikb.speakasapen` and App Store `https://itunes.apple.com/us/app/anglijskij-azyk-za-7-urokov/id1002144129`.
- `/en/seven/1` retained the app links, PDF href `/media/pdf/en/lesson1.pdf`, and answer disclosure interaction opened successfully.
- Computed lesson typography remained aligned with legacy evidence: paragraph `16px/30px/rgb(66, 66, 66)` and heading `PT Mono 32px/40px/rgb(44, 150, 255)`.
- Browser console warning/error logs were empty for course and lesson pages; framework overlay checks were false.
- Screenshots saved locally outside the repo: `/tmp/speakasap-seven-app-promo-course.png` and `/tmp/speakasap-seven-app-promo-lesson.png`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Temporary mock gateway, Next preview, and SSH port-forward were used only for no-write QA and must be stopped after validation.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Fresh Target Reconciliation V12

Status: DB-backed no-write reconciliation completed; approval gate remains before schema/data writes.

Changed:

- Re-ran the seven importer with `--check-target` against the Kubernetes-backed content database using the fresh v12 payload that includes structured media refs and legacy Android/iOS app URL metadata.
- Used a temporary remote Postgres port-forward only for read-only target inspection; it had no remaining listener after the check.

Verification evidence:

- `/tmp/speakasap-seven-dry-run-target-v12.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, `blockingIssues=[]`, and 4 expected warnings.
- The report recorded `legacyAppUrls.android=18`, `legacyAppUrls.ios=17`, `courseRowsWithAndroidUrl=18`, and `courseRowsWithIosUrl=17`.
- The report recorded `migrationMediaRefs.lessonRowsWithRefs=136`, `migrationMediaRefs.exerciseRowsWithRefs=408`, and `migrationMediaRefs.uniqueRefs=1104`.
- Target DB was reachable with `target.checked=true` and planned IDs/keys `19/136/429`.
- Target table errors remain expected before owner-approved schema migration: `SevenCourse`, `SevenLesson`, and `SevenExercise` do not exist yet.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Temporary DB port-forward was stopped/no longer listening after the report.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for content-service base schema readiness plus seven schema creation, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Schema Migration Approval Packet

Status: approval packet prepared; no schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Added `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md` with the exact schema-only approval scope, preserved intent, proposed command, required post-apply no-write reconciliation, rollback SQL for empty seven tables, and explicit approval wording.
- Bound the approval request to current evidence from `/tmp/speakasap-seven-dry-run-v12.json` and `/tmp/speakasap-seven-dry-run-target-v12.json`.

Verification evidence:

- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- Approval packet confirms the next approval is only for creating empty `SevenCourse`, `SevenLesson`, and `SevenExercise` schema objects and does not approve data apply or deploy.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using the wording in `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md`, then apply only the schema migration and rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Full Planned-Match Reconciliation Counts

Status: implemented and verified in no-write mode; approval gate remains before schema/data writes.

Changed:

- Hardened `content-service/scripts/migrate-seven-from-legacy.py` target reconciliation so planned target matches are counted with full `COUNT(*)` queries, while samples remain limited separately.
- This prevents post-data reconciliation from reporting only the sample size for `SevenLesson` or `SevenExercise` when more than the sample limit exists.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v13.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, app URL coverage `18/17`, media refs `136/408/1104`, no blocking issues, and 4 expected warnings.
- `/tmp/speakasap-seven-dry-run-target-v13.json` recorded `writes=false`, target checked, planned IDs/keys `19/136/429`, no blocking issues, and expected missing-table errors for `SevenCourse`, `SevenLesson`, and `SevenExercise` before schema migration.
- Temporary DB port-forward `15437` was stopped and had no remaining listener.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md`, then apply only the schema migration and rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Target Base Content Schema Readiness

Status: no-write target check found a pre-schema blocker; approval gate updated.

Changed:

- Hardened the seven target dry-run to check `Language` table/code readiness before schema or data apply.
- Updated `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md` with the target base schema finding.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v14.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and 4 expected warnings.
- `/tmp/speakasap-seven-dry-run-target-v14.json` recorded `writes=false`, `target.checked=true`, blocking issue `TARGET_LANGUAGE_TABLE_UNAVAILABLE`, and planned language codes `19`.
- Read-only information_schema inventory through temporary remote port-forward `15440` returned public tables `[]` and no `_prisma_migrations` table for `speakasap_content_db`.
- Temporary port-forwards `15439` and `15440` were stopped and had no remaining listeners.

Implication:

- Applying only the seven schema migration would currently fail because `SevenCourse.languageId` references missing table `Language`.
- The next owner approval must first cover content-service base schema readiness/apply, then seven schema migration, still with no seven data apply or deployment.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for content-service base schema readiness followed by seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Content Base Schema Approval Packet

Status: approval packet prepared; no schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Added `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` documenting why the target content DB needs base schema readiness before seven schema/data work.
- The packet scopes owner approval to applying pending content-service Prisma migrations for empty schema creation only, then DB-backed no-write seven reconciliation.
- The packet records rollback boundaries for empty schema objects and keeps seven data apply, deploy, object mutation, and legacy retirement out of scope.

Verification evidence:

- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- Existing no-write target evidence remains `/tmp/speakasap-seven-dry-run-target-v14.json` with `TARGET_LANGUAGE_TABLE_UNAVAILABLE` and public tables `[]` in the content DB.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, then apply pending content-service schema migrations and rerun DB-backed no-write seven reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Language Seed Readiness For Seven Data Migration

Status: no-write implementation complete; target content DB still awaits owner-approved schema readiness.

Changed:

- Extended `content-service/scripts/migrate-seven-from-legacy.py` to include planned legacy `Language` rows in the seven migration payload.
- Added write-gated `--include-languages` support so an approved later data apply can seed/update only the 19 language rows required by seven courses before importing `SevenCourse`, `SevenLesson`, and `SevenExercise` rows.
- Replaced ad hoc YAML regex parsing with PyYAML parsing to preserve Russian language `name` and `speaker` text exactly.
- Added `docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md` and updated the schema approval packet to keep schema readiness separate from data apply.

Verification:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `content-service/scripts/migrate-seven-from-legacy.py --help` shows `--include-languages`.
- `/tmp/speakasap-seven-dry-run-v16.json` recorded `writes=false`, payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and corrected language names/speakers.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` still refuses before any connection/write without `--confirm-write`.
- `/tmp/speakasap-seven-dry-run-target-v16.json` recorded `writes=false`, `target.checked=true`, payload `19/19/136/429`, and expected blocker `TARGET_LANGUAGE_TABLE_UNAVAILABLE` because the target DB still lacks the base schema.

Boundary:

- No content-service schema migration was applied.
- No language or seven content rows were written.
- No frontend/content/gateway deployment, object mutation, media copy, final test migration, private progress migration, paid-product change, destructive operation, or legacy route retirement ran.

Next:

- Get owner approval for `CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service schema migrations only, rerun DB-backed no-write reconciliation, then request the separate `SEVEN_DATA_MIGRATION_APPROVAL.md` data apply approval if the no-write evidence is clean.

## 2026-06-13 - Goal 10 Seven Media Readiness Inventory

Status: no-write media readiness added; public media serving remains incomplete.

Changed:

- Extended `content-service/scripts/migrate-seven-from-legacy.py` to report all unique media refs, planned PDF refs, counts by kind/prefix, and YouTube refs from rendered legacy video tags.
- Added `content-service/scripts/check-seven-media-availability.py` for no-write public availability checks of reported media refs.
- Added `docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md` for the later media copy/routing approval gate.

Verification:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py content-service/scripts/check-seven-media-availability.py` passed.
- `/tmp/speakasap-seven-dry-run-v18.json` recorded `writes=false`, payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, media refs `audio=1104`, `pdf=136`, `video=133`, and total unique refs `1373`.
- `/tmp/speakasap-seven-dry-run-target-v17.json` recorded `writes=false`, `target.checked=true`, payload `19/19/136/429`, media refs `audio=1104`, `pdf=136`, `video=133`, and expected blocker `TARGET_LANGUAGE_TABLE_UNAVAILABLE`.
- Public sample checks showed current media gap: `/tmp/speakasap-seven-media-check-sample-v18.json` against `https://speakasap.alfares.cz` returned `6/6` missing with HTTP `404`; `/tmp/speakasap-seven-media-check-assets-sample-v18.json` against `https://assets.alfares.cz` also returned `6/6` missing with HTTP `404`.
- RAG retrieval was attempted first but unavailable in the remote shell because no `JWT_TOKEN` was available from the checked runtime secret path; repository and live route evidence were used.

Boundary:

- No media copy, object mutation, route change, deployment, schema migration, data apply, destructive operation, private media migration, paid-product change, final test migration, or legacy route retirement ran.

Next:

- Keep the immediate gate on `CONTENT_BASE_SCHEMA_APPROVAL.md`; in parallel, locate authoritative legacy `/media/audio` and `/media/pdf` source storage before requesting `SEVEN_MEDIA_MIGRATION_APPROVAL.md`.


## 2026-06-13 - Goal 10 Seven Media Source Discovery

Status: read-only source discovery completed; media copy/routing remains approval-gated.

Evidence:

- `https://speakasap.com` was tested as a legacy production source candidate using no-write HEAD checks.
- `/tmp/speakasap-seven-media-check-legacy-source-v1.json` checked `1240` internal `/media` refs from `/tmp/speakasap-seven-dry-run-v18-final.json`: `1212` returned HTTP `200`, `28` returned HTTP `404`.
- All `136/136` PDF refs returned HTTP `200`; `1076/1104` audio refs returned HTTP `200`.
- Missing refs are limited to `media/audio/ru` (`28` refs), including `lesson1..lesson7` mp3/ogg and `lesson*_answer1` mp3/ogg.
- Direct sample checks returned HTTP `200` for `https://speakasap.com/media/audio/en/lesson1.mp3`, `https://speakasap.com/media/pdf/en/lesson1.pdf`, and `https://speakasap.com/media/audio/cn/lesson1.mp3`.
- Read-only filesystem searches did not find matching sample source files under `/home/ssf/Documents/Github`, `/srv`, `/mnt`, `/opt`, or `/var/www`; `speakasap-portal/media` remains absent in the checkout.

Boundary:

- No media copy, download/archive creation, object mutation, route change, deployment, schema migration, data apply, destructive operation, private media migration, paid-product change, final test migration, or legacy route retirement ran.

Next:

- Treat `https://speakasap.com` as the current source candidate for approved media migration, but resolve or explicitly document the `media/audio/ru` gap before claiming complete media parity.


## 2026-06-13 - Goal 10 Seven Media Copy Manifest

Status: no-write copy manifest prepared; media copy/routing remains approval-gated.

Changed:

- Added `content-service/scripts/prepare-seven-media-manifest.py`, which reads the no-write availability report and emits JSON/CSV copy-review artifacts only.
- Updated `docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md` with copy manifest evidence and scope.

Verification:

- `python3 -m py_compile content-service/scripts/prepare-seven-media-manifest.py` passed.
- `/tmp/speakasap-seven-media-copy-manifest-v1.json` was generated from `/tmp/speakasap-seven-media-check-legacy-source-v1.json` and recorded `writes=false`, `1240` total internal refs, `1212` available copy candidates, and `28` missing refs.
- Available candidates by kind: `audio=1076`, `pdf=136`; missing by kind: `audio=28`; missing by prefix: `media/audio/ru=28`.
- Available source-header sizes: audio `3229902938` bytes and PDF `11240877` bytes.
- CSV artifacts: `/tmp/speakasap-seven-media-copy-manifest-v1.csv` and `/tmp/speakasap-seven-media-missing-v1.csv`.

Boundary:

- No media download, media copy, object mutation, route change, deployment, schema migration, data apply, destructive operation, private media migration, paid-product change, final test migration, or legacy route retirement ran.

Next:

- Use `/tmp/speakasap-seven-media-copy-manifest-v1.json` as the candidate list for a future owner-approved media copy/routing step, after deciding how to handle the 28 missing `media/audio/ru` refs.

## 2026-06-13 - Goal 10 Seven Deployment Readiness

Status: no-write deployment readiness prepared; deployment remains approval-gated.

Changed:

- Added `scripts/check-seven-deployment-smoke.py` for no-write health/API/page/media smoke checks after deployment.
- Added `docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md` to scope deployment to `speakasap-content`, `speakasap-api-gateway`, and `speakasap-frontend` after schema/data/media gates.

Verification:

- `python3 -m py_compile scripts/check-seven-deployment-smoke.py` passed.
- Current Kubernetes read-only status showed `speakasap-content`, `speakasap-api-gateway`, and `speakasap-frontend` deployments `1/1` ready with `0` restarts in current pods.
- `/tmp/speakasap-seven-deployment-smoke-current-v1.json` recorded `writes=false`, overall `ok=false`, with statuses `health=200`, `courseApi=401`, `lessonsApi=401`, `lessonApi=401`, `coursePage=404`, `lessonPage=404`, `pdfHead=404`, `audioHead=404`.
- These failures are expected before seven schema/data/media availability and before deploying gateway/frontend changes.

Boundary:

- No image build, push, deployment, route change, schema migration, data apply, media copy, object mutation, destructive operation, private media migration, paid-product change, final test migration, or legacy route retirement ran.

Next:

- Keep the immediate gate on `CONTENT_BASE_SCHEMA_APPROVAL.md`; after schema/data/media gates complete, use `SEVEN_DEPLOYMENT_APPROVAL.md` for the scoped deployment approval and run the post-deploy smoke checker plus browser typography QA.


## 2026-06-13 - Goal 10 Rendered HTML Safety Gate

Status: no-write HTML safety gate added; source payload remains clean.

Changed:

- Extended `content-service/scripts/migrate-seven-from-legacy.py` to add an `htmlSafety` report section and block apply if rendered lesson/exercise/answer HTML contains unresolved Django delimiters, `<script>` tags, `<form>` tags, inline event handlers, or `javascript:` URLs.

Verification:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v19.json` recorded `writes=false`, no blocking issues, and `htmlSafety.ok=true`.
- `htmlSafety` checked `993` rendered HTML fragments with zero `djangoBlocks`, `scriptTags`, `formTags`, `inlineEventHandlers`, and `javascriptUrls`.
- Repository grep showed inline handlers only in legacy reusable tag templates such as `seven/templates/seven/tags/audio.html` and `video.html`; the static renderer replaces those tags with handler-free HTML in the migrated payload.

Boundary:

- No schema migration, data apply, deployment, media copy, route change, object mutation, destructive operation, private media migration, paid-product change, final test migration, or legacy route retirement ran.

Next:

- Keep the immediate gate on `CONTENT_BASE_SCHEMA_APPROVAL.md`; the rendered HTML safety gate will continue to run before any approved data apply.
## 2026-06-13 - Goal 10 Seven Contract And Smoke Hardening

Status: no-write contract hardening completed; no schema migration, seven data apply, media copy, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Spawned read-only sub-agent Huygens to validate current seven frontend/API/gateway contracts on alfares; it made no edits and reported rollout risks around media routing, deployed gateway auth, partial API failure handling, and legacy 8-row courses.
- Hardened scripts/check-seven-deployment-smoke.py so the no-write deployment smoke now checks API payload shape, lesson body presence, PDF/media refs, absence of unresolved legacy template syntax, and frontend page markers: seven-page, seven-lessons-grid, seven-page--lesson, lesson__content--seven, and lesson-wrapper.
- Hardened frontend/lib/seven.ts to settle course, lessons, and lesson-detail API calls independently. A neighbor-list or metadata failure no longer discards successfully fetched lesson content.
- Verified legacy preservation for non-7 row courses: legacy speakasap_site/templates/site/seven/index.html renders course.get_lessons without a hard limit, and fixtures show EN course 1, DE course 4, and CN course 18 have 8 visible rows. The target should preserve those rows rather than truncate to exactly seven DB rows.

Verification:

- cd frontend && npm run build passed after the frontend/lib/seven.ts hardening and still lists dynamic routes /[languageCode]/seven and /[languageCode]/seven/[order].
- python3 -m py_compile scripts/check-seven-deployment-smoke.py passed.
- Current production baseline remains expected-failing before deploy/data/media: /tmp/speakasap-seven-deployment-smoke-current-v2.json recorded writes=false, health 200, seven APIs 401, seven pages 404, PDF/audio 404, and explicit failed assertions for API/page/media contracts.
- Legacy fixture evidence for the 8-row courses was printed from portal/fixtures/seven.xml: EN order 8 7 Keys to study English, DE split lesson 1 into parts 1/2 plus lessons 2-7, and CN order 8 Чтение и аудирование на китайском языке.

Boundary:

- No target DB schema or data write ran.
- No media copy or static route change ran.
- No Kubernetes deploy or rollout restart ran.
- Legacy portal remains the behavior/style fallback.

Next:

- Approval is still required for the schema-only content DB migration from docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md; after that, rerun DB-backed no-write reconciliation and keep media/deploy approvals separate.
## 2026-06-13 - Goal 10 Seven Assets Base Media Contract

Status: code contract aligned with existing platform assets host; no schema migration, seven data apply, media copy, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Aligned seven public media URLs with the existing new-platform ASSETS_BASE_URL contract already used by content-service language icon responses and Kubernetes service config.
- Updated content-service/src/seven/seven.service.ts so pdfHref, mediaRefs, and /media/... links inside lesson/exercise/answer HTML are rewritten at response time to ASSETS_BASE_URL + /media/... when ASSETS_BASE_URL is configured. Without the env var, the API keeps the legacy relative /media/... shape.
- Updated scripts/check-seven-deployment-smoke.py with --assets-base-url defaulting to https://assets.alfares.cz, so deployment smoke validates the same public media base that content-service will emit.

Verification:

- cd content-service && npm run build passed.
- python3 -m py_compile scripts/check-seven-deployment-smoke.py passed.
- /tmp/speakasap-seven-deployment-smoke-current-v3.json recorded writes=false, assetsBaseUrl=https://assets.alfares.cz, expected PDF href https://assets.alfares.cz/media/pdf/en/lesson1.pdf, and current expected failures before rollout/media copy: seven APIs 401, pages 404, PDF/audio 404.

Boundary:

- No files were copied to assets.alfares.cz.
- No /media route, ingress, or object storage mutation ran.
- No target DB schema/data write or Kubernetes deploy ran.

Next:

- Keep schema-only approval first. Media approval later should copy the approved manifest to the asset host path that serves https://assets.alfares.cz/media/..., then rerun the smoke checker against the same assets base.
## 2026-06-13 - Goal 10 Seven Assets Contract Checker

Status: no-write verifier added for seven media URL mapping; no schema migration, seven data apply, media copy, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Added content-service/scripts/check-seven-assets-contract.py to validate the dry-run media refs against the chosen ASSETS_BASE_URL public URL contract without network calls or data writes.
- The checker verifies that legacy /media/... refs map to the asset host while preserving /media path suffixes, external video refs remain external, duplicate mapping does not occur, and the planned PDF count matches PDF refs in the migration report.
- Normalized indentation in content-service/src/seven/seven.service.ts around exercise response serialization after the media rewrite change.

Verification:

- python3 -m py_compile content-service/scripts/check-seven-assets-contract.py passed.
- content-service/scripts/check-seven-assets-contract.py --input-report /tmp/speakasap-seven-dry-run-v19.json --assets-base-url https://assets.alfares.cz --json-report /tmp/speakasap-seven-assets-contract-v1.json passed with ok=true.
- /tmp/speakasap-seven-assets-contract-v1.json counted refs=1373, internalRefs=1240, externalRefs=133, audio=1104, pdf=136, video=133, plannedPdfRefCount=136, failed assertions=[]; sample mapping /media/audio/cn/lesson1.mp3 -> https://assets.alfares.cz/media/audio/cn/lesson1.mp3.

Boundary:

- This proves URL mapping only. It does not prove asset availability; copy/availability remains blocked on separate media approval.
- No target DB schema/data write or Kubernetes deploy ran.

Next:

- After schema-only approval and DB-backed no-write reconciliation, keep using /tmp/speakasap-seven-assets-contract-v1.json plus the availability checker as media-copy acceptance evidence.
## 2026-06-13 - Goal 10 Seven Apply Readiness Aggregator

Status: no-write readiness aggregator added; no schema migration, seven data apply, media copy, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Added content-service/scripts/check-seven-apply-readiness.py to aggregate dry-run, assets-contract, deployment-smoke, and approval-packet evidence into one gate report.
- The checker reports separate source, assets, schema, data, and deploy gates so owner approval can be scoped to the next safe action instead of implying full cutover readiness.

Verification:

- python3 -m py_compile content-service/scripts/check-seven-apply-readiness.py passed.
- /tmp/speakasap-seven-apply-readiness-v1.json was generated from dry-run v19, assets-contract v1, and deployment-smoke current v3.
- Readiness v1 recorded ok=true for owner schema approval readiness and complete=false for the full migration. Schema gate: approvalDocsPresent=true, sourceDryRunReady=true, assetsContractReady=true, readyForOwnerSchemaApproval=true. Data gate: targetChecked=false, readyForOwnerDataApproval=false. Next action: get explicit schema-only approval, apply content-service schema migrations, then rerun DB-backed no-write reconciliation.

Boundary:

- The readiness checker does not connect to the DB, call the network, copy media, or deploy. It only aggregates existing no-write evidence.
- The goal remains incomplete until schema/data/media/deploy are applied with separate approvals and production smoke/browser QA passes.

Next:

- Use /tmp/speakasap-seven-apply-readiness-v1.json as the current evidence that the next valid owner decision is CONTENT_BASE_SCHEMA_APPROVAL.md only.

## 2026-06-13 - Goal 10 Seven Deployment Readiness Contract

Status: no-write deployment readiness contract added; no schema migration, seven data apply, media copy, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Added scripts/check-seven-deployment-readiness.py to validate that the future seven deployment approval is scoped to speakasap-content, speakasap-api-gateway, and speakasap-frontend only.
- The checker verifies the deployment approval packet, scoped manifests, frontend deploy script, root deploy breadth, ASSETS_BASE_URL/NEXT_PUBLIC_API_URL config, rollback boundary, and post-deploy smoke requirements.
- It intentionally reports readyForCutover=false because schema/data/media/deploy have not been approved or run.

Verification:

- `python3 -m py_compile scripts/check-seven-deployment-readiness.py` passed.
- `/tmp/speakasap-seven-deployment-readiness-v1.json` recorded `writes=false`, `ok=true`, `readyForOwnerDeploymentApproval=true`, `readyForCutover=false`, and failed assertions `[]`.
- `python3 -m py_compile content-service/scripts/check-seven-apply-readiness.py` passed after wiring the deployment readiness report into the deploy gate.
- `/tmp/speakasap-seven-apply-readiness-v8.json` recorded `writes=false`, `ok=true`, `complete=false`, deployment readiness `readyForOwnerDeploymentApproval=true`, current production smoke `deploymentSmokeOk=false`, and `readyForCutover=false`.
- `/tmp/speakasap-seven-goal-completion-audit-v2.json` recorded `writes=false`, `ok=false`, `complete=false`; remaining requirements are `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.
- `git diff --check` passed.

Boundary:

- This checker reads repository files only. It does not build images, push images, call kubectl, restart services, connect to the database, copy media, or mutate any object storage.

Next:

- Use the generated deployment readiness report later, after schema/data/media gates complete, as the precondition evidence for the scoped deployment approval packet.

## 2026-06-13 - Goal 10 Orchestrator Evidence Freshness

Status: no-write documentation freshness update completed; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Updated `TASKS.md` to point at current seven evidence (`dry-run-v20`, post-schema pre-approval reconciliation, apply-readiness-v8, media manifest v3, deployment-readiness-v1) instead of stale v13/v14/v1 references.
- Updated `docs/orchestrator/SEVEN_INTENT_PRESERVATION_EVIDENCE.md` commit-message evidence references from v19/v1 to v20/v2/v8/v2.
- Checked the RAG prerequisite; RAG was unavailable because `JWT_TOKEN` is not set in the remote shell, so repository evidence remains the active source for this chunk.

Verification:

- `git diff --check` passed.
- RAG check returned `RAG_UNAVAILABLE: JWT_TOKEN is not set`; repository evidence was used as the authoritative source for this no-write chunk.
- `/tmp/speakasap-seven-dry-run-v20.json` currently records `writes=false`, `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, media refs `audio=1076`, `pdf=136`, `video=133`.
- `/tmp/speakasap-seven-apply-readiness-v8.json` currently records `writes=false`, `ok=true`, `complete=false`, `readyForOwnerSchemaApproval=true`, `readyForOwnerDataApproval=false`, and `readyForCutover=false`.
- `/tmp/speakasap-seven-deployment-readiness-v1.json` currently records `writes=false`, `ok=true`, scoped deployment approval readiness true, and cutover false.
- `/tmp/speakasap-seven-goal-completion-audit-v2.json` currently records `writes=false`, `ok=false`, `complete=false`; remaining requirements are `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

## 2026-06-13 - Goal 10 Schema Execution Contract Hardening

Status: no-write schema approval runbook hardened; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Updated `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` to avoid `npm run prisma:migrate:deploy` for the approved schema-only command.
- The approval packet now uses direct `npx prisma migrate deploy --schema prisma/schema.prisma` with `DATABASE_URL` exported from the Kubernetes content-service secret through the temporary port-forward.
- Extended `content-service/scripts/check-seven-schema-migration-plan.py` with an execution contract that verifies the approval packet uses the direct Prisma command, derives `DATABASE_URL` from the Kubernetes secret, avoids the npm wrapper, and documents why the wrapper is unsafe on hosts with root `.env`.

Verification:

- `python3 -m py_compile content-service/scripts/check-seven-schema-migration-plan.py` passed.
- `/tmp/speakasap-seven-schema-migration-plan-v3.json` recorded `writes=false`, `ok=true`, expected migrations/models/relations present, and `schemaExecutionContractSafe=true`.
- `/tmp/speakasap-seven-apply-readiness-v9.json` recorded `writes=false`, `ok=true`, `complete=false`, schema gate ready, data gate not ready, current production smoke not ready, and cutover false.
- `/tmp/speakasap-seven-goal-completion-audit-v3.json` recorded `writes=false`, `ok=false`, `complete=false`; remaining requirements are `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.
- `git diff --check` passed.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

## 2026-06-13 - Goal 10 Data Approval Packet Cleanup

Status: no-write data approval packet cleanup completed; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Removed an accidentally embedded STATUS/readiness section from `docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md`, leaving a single clean approval packet.
- Updated the packet to reference the regenerated data apply contract report path `/tmp/speakasap-seven-data-apply-contract-v3.json`.
- Extended `content-service/scripts/check-seven-data-apply-contract.py` so it verifies the data approval packet shape: schema precondition, exact row counts, `CONTENT_TARGET_DATABASE_URL`, `--check-target --apply --include-languages --confirm-write`, approval note, rollback SQL path, no-write post-apply verification, excluded scopes, and absence of embedded STATUS sections.

Verification:

- `python3 -m py_compile content-service/scripts/check-seven-data-apply-contract.py` passed.
- `/tmp/speakasap-seven-data-apply-contract-v3.json` recorded `writes=false`, `ok=true`, `approvalContractSafe=true`, exact counts verified, write gates present, rollback/language scope present, and no embedded STATUS sections in the data approval packet.
- `/tmp/speakasap-seven-apply-readiness-v10.json` recorded `writes=false`, `ok=true`, `complete=false`, schema gate ready, data apply contract ready, post-schema reconciliation not ready, data approval not ready, and cutover false.
- `/tmp/speakasap-seven-goal-completion-audit-v4.json` recorded `writes=false`, `ok=false`, `complete=false`; remaining requirements are `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.
- Pending in this chunk: run `git diff --check`.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`; data approval remains later and separate.

## 2026-06-13 - Goal 10 Media Approval Contract Cleanup

Status: no-write media approval packet cleanup completed; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Removed accidentally embedded STATUS sections from `docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md`.
- Updated the packet from stale v18/v1 media evidence to current v20/v3 evidence: `audio=1076`, `pdf=136`, `1212` internal refs, and `0` missing source refs.
- Aligned pre/post-copy verification wording with the current asset host contract `https://assets.alfares.cz/media/...`.
- Added `content-service/scripts/check-seven-media-approval-contract.py` to verify the media approval packet and no-write source/manifest/assets evidence without copying files or mutating routes.

Verification:

- `python3 -m py_compile content-service/scripts/check-seven-media-approval-contract.py content-service/scripts/check-seven-apply-readiness.py` passed.
- `/tmp/speakasap-seven-media-approval-contract-v1.json` recorded `writes=false`, `ok=true`, `approvalContractSafe=true`, and `evidenceContractSafe=true`.
- `/tmp/speakasap-seven-apply-readiness-v11.json` recorded `writes=false`, `ok=true`, `complete=false`, schema gate ready, media source/approval contract ready, data gate not ready, current production smoke not ready, and cutover false.
- `/tmp/speakasap-seven-goal-completion-audit-v5.json` recorded `writes=false`, `ok=false`, `complete=false`; remaining requirements are `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.
- Pending in this chunk: run `git diff --check`.

Boundary:

- No media download/copy/object mutation, route change, target database connection, content DB schema migration, seven data apply, image build/push, Kubernetes rollout, destructive rollback, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate first; media copy approval remains later and separate.

## 2026-06-13 - Goal 10 Gateway Public Access Contract

Status: no-write gateway routing/auth contract added; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Added `scripts/check-seven-gateway-contract.py` to verify the seven gateway boundary without running services.
- The checker verifies `/api/v1/seven` routes to `CONTENT_SERVICE_URL`, the proxy controller remains guarded, anonymous access is limited to `GET /api/v1/seven...`, non-GET seven requests still fall through to bearer auth, internal routes stay token-protected, and frontend uses gateway seven endpoints.
- Wired the gateway contract report into `content-service/scripts/check-seven-apply-readiness.py` as part of deployment approval readiness.

Verification:

- `python3 -m py_compile scripts/check-seven-gateway-contract.py content-service/scripts/check-seven-apply-readiness.py` passed.
- `/tmp/speakasap-seven-gateway-contract-v1.json` recorded `writes=false`, `ok=true`, `/api/v1/seven` routes to `CONTENT_SERVICE_URL`, anonymous access is limited to `GET /api/v1/seven...`, non-GET seven requests fall through to bearer auth, internal routes remain token-protected, and frontend uses gateway seven endpoints.
- `/tmp/speakasap-seven-apply-readiness-v12.json` recorded `writes=false`, `ok=true`, `complete=false`, schema gate ready, media source/approval contract ready, gateway contract ready, data gate not ready, current production smoke not ready, and cutover false.
- `/tmp/speakasap-seven-goal-completion-audit-v6.json` recorded `writes=false`, `ok=false`, `complete=false`; remaining requirements are `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.
- Pending in this chunk: run `git diff --check`.

Boundary:

- No gateway deployment, target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate first; gateway deployment remains later and separate.

## 2026-06-13 - Goal 10 Content API Contract

Status: no-write content-service API contract added; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Added `scripts/check-seven-content-api-contract.py` to verify the seven content API shape without running services.
- The checker verifies the global `/api/v1` prefix, SevenModule mounting, controller base route, read-only GET endpoints, invalid lesson-order rejection, 404 behavior, response fields consumed by frontend, lesson navigation fields, `po` to `pl` normalization, metadata media refs, and `ASSETS_BASE_URL` media rewrite.
- Wired the content API contract report into `content-service/scripts/check-seven-apply-readiness.py` as part of deployment approval readiness.

Verification:

- `python3 -m py_compile scripts/check-seven-content-api-contract.py content-service/scripts/check-seven-apply-readiness.py` passed.
- `/tmp/speakasap-seven-content-api-contract-v1.json` recorded `writes=false`, `ok=true`, read-only seven GET endpoints, frontend-compatible response fields, `ASSETS_BASE_URL` media rewrite, lesson navigation fields, and no mutating seven controller decorators.
- `/tmp/speakasap-seven-apply-readiness-v13.json` recorded `writes=false`, `ok=true`, `complete=false`, schema gate ready, content API contract ready, gateway contract ready, media source/approval contract ready, data gate not ready, current production smoke not ready, and cutover false.
- `/tmp/speakasap-seven-goal-completion-audit-v7.json` recorded `writes=false`, `ok=false`, `complete=false`; remaining requirements are `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.
- Pending in this chunk: run `git diff --check`.

Boundary:

- No content-service deployment, target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate first; content-service deployment remains later and separate.

## 2026-06-13 - Goal 10 Frontend Route Contract

Status: no-write frontend route contract added; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Added `scripts/check-seven-frontend-route-contract.py` to verify the seven frontend routes and client data loading without running the frontend.
- The checker verifies gateway-backed data loading, course lesson cards, lesson legacy content wrapper, PDF fallback/download, exercises/answers, previous/next navigation, app promo messaging, reading indicator, SEO metadata, and empty/error fallback states.
- Wired the frontend route contract report into `content-service/scripts/check-seven-apply-readiness.py` as part of deployment approval readiness.

Verification:

- `python3 -m py_compile scripts/check-seven-frontend-route-contract.py content-service/scripts/check-seven-apply-readiness.py` passed.
- `/tmp/speakasap-seven-frontend-route-contract-v1.json` recorded `writes=false`, `ok=true`, gateway-backed data loading, course lesson cards, lesson content wrapper, PDF download/fallback, exercises/answers, previous/next navigation, app promo messaging, reading indicator, SEO metadata, and error fallback states.
- `/tmp/speakasap-seven-apply-readiness-v14.json` recorded `writes=false`, `ok=true`, `complete=false`, schema gate ready, frontend route contract ready, content API contract ready, gateway contract ready, media source/approval contract ready, data gate not ready, current production smoke not ready, and cutover false.
- `/tmp/speakasap-seven-goal-completion-audit-v8.json` recorded `writes=false`, `ok=false`, `complete=false`; remaining requirements are `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.
- Pending in this chunk: run `git diff --check`.

Boundary:

- No frontend deployment, target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate first; frontend deployment remains later and separate.

## 2026-06-13 - Goal 10 Completion Audit Contract Coverage

Status: no-write completion audit hardened; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Extended `scripts/check-seven-goal-completion.py` so final completion requires explicit readiness contract gates, not only file existence.
- The completion audit now requires frontend route, content API, gateway public access, data apply, media approval, and deployment readiness contracts to be proven before any future `complete=true` result is possible.

Verification:

- `python3 -m py_compile scripts/check-seven-goal-completion.py` passed.
- `/tmp/speakasap-seven-goal-completion-audit-v9.json` recorded `writes=false`, `ok=false`, `complete=false`.
- New explicit contract requirements pass: frontend route, content API, gateway public access, data apply contract, media approval contract, deployment readiness contracts, and typography contract.
- Remaining missing requirements are still the real runtime gates: `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.
- `git diff --check` passed.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

## 2026-06-13 - Goal 10 No-Write Validation Suite

Status: no-write validation suite added; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Added `scripts/check-seven-no-write-suite.py` to regenerate the local no-write contract reports, aggregate readiness, and completion audit from existing no-write inputs.
- The suite intentionally avoids DB connections, network checks, media copy, image builds, kubectl, route changes, deployment, destructive rollback, and legacy retirement.
- Media source availability and deployment smoke remain explicit input reports so the suite is reproducible without making network calls.

Verification:

- `python3 scripts/check-seven-no-write-suite.py --json-report /tmp/speakasap-seven-no-write-suite-v1.json` passed.
- `/tmp/speakasap-seven-no-write-suite-v1.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, and `complete=false`.
- Suite readiness summary: `ok=true`, `complete=false`, next action remains schema-only approval and DB-backed no-write reconciliation.
- Suite completion summary: missing requirements remain `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.
- `python3 -m py_compile scripts/check-seven-no-write-suite.py` passed.
- `git diff --check` passed.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

## 2026-06-13 - Goal 10 Fresh Build And Suite Validation

Status: fresh build and no-write suite validation passed; schema/data/media/deploy gates remain approval-blocked.

Verification:

- `cd content-service && npm run build` passed.
- `cd api-gateway && npm run build` passed.
- `cd frontend && npm run build` passed; Next build listed dynamic routes `/(languageCode)/seven` and `/(languageCode)/seven/[order]`.
- `python3 scripts/check-seven-no-write-suite.py --json-report /tmp/speakasap-seven-no-write-suite-v2.json` passed.
- `/tmp/speakasap-seven-no-write-suite-v2.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, and `complete=false`.
- `git diff --check` passed.

Boundary:

- No target database connection, content DB schema migration, seven data apply, media download/copy/object mutation, image push, Kubernetes rollout, public route cutover, destructive rollback, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

## 2026-06-13 - Goal 10 Runtime Approval Sequence

Status: no-write approval-sequence runbook and checker added; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Added `docs/orchestrator/SEVEN_RUNTIME_APPROVAL_SEQUENCE.md` as the canonical runtime order: schema, data, media, deploy, visual QA, then runtime evidence.
- Added `scripts/check-seven-approval-sequence.py` to statically verify the runbook mentions the required approval packets, operators, report paths, sequence boundaries, and no inferred approval.
- Wired the approval-sequence checker into `scripts/check-seven-no-write-suite.py`.

Verification:

- `python3 scripts/check-seven-approval-sequence.py --json-report /tmp/speakasap-seven-approval-sequence-v1.json` passed.
- `/tmp/speakasap-seven-approval-sequence-v1.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, no missing markers/files/boundary phrases, and no forbidden phrase hits.
- `python3 scripts/check-seven-no-write-suite.py --json-report /tmp/speakasap-seven-no-write-suite-v18.json` passed.
- `/tmp/speakasap-seven-no-write-suite-v18.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`; remaining missing completion gates are `postDeployVisualQaPassed`, `runtimeEvidenceChainComplete`, `schemaAppliedAndReconciled`, `dataReadyForApproval`, `deploymentSmokePassed`, and `cutoverReady`.
- `git diff --check` passed.

Boundary:

- No target database connection, schema migration, data apply, media copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, public route cutover, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

## 2026-06-13 - Goal 10 Next-Gate Preflight

Status: no-write next-gate preflight added; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Added `scripts/check-seven-next-gate.py` to determine the next requestable runtime gate from current readiness, approval-sequence, and runtime evidence artifacts.
- Wired the next-gate checker into `scripts/check-seven-no-write-suite.py`.
- The checker enforces schema -> data -> media -> deploy -> visual QA -> runtime evidence ordering and reports the next approval packet/operator.

Verification:

- `python3 scripts/check-seven-next-gate.py --json-report /tmp/speakasap-seven-next-gate-v1.json` passed.
- `/tmp/speakasap-seven-next-gate-v1.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `nextGate=schema`, `nextGateRequestable=true`, next approval packet `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, and next operator `scripts/apply-seven-schema-approved.sh --execute`.
- `python3 scripts/check-seven-no-write-suite.py --json-report /tmp/speakasap-seven-no-write-suite-v19.json` passed.
- `/tmp/speakasap-seven-no-write-suite-v19.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`, and embedded next-gate summary `nextGate=schema`.
- `git diff --check` passed.

Boundary:

- No target database connection, schema migration, data apply, media copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, public route cutover, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

## 2026-06-13 - Goal 10 Schema Approval Evidence Freshness

Status: active schema approval packet now references current next-gate/no-write evidence; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Updated `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` to replace stale no-write suite v7 evidence with `/tmp/speakasap-seven-next-gate-v1.json` and `/tmp/speakasap-seven-no-write-suite-v19.json`.
- Hardened `content-service/scripts/check-seven-schema-migration-plan.py` so active schema approval evidence must reference no-write suite v19+ and next-gate v1+ with `nextGate=schema` and `nextGateRequestable=true`.
- Updated seven intent evidence to expect schema plan v10 and suite v20.

Verification:

- `python3 content-service/scripts/check-seven-schema-migration-plan.py --json-report /tmp/speakasap-seven-schema-migration-plan-v10.json` passed.
- `/tmp/speakasap-seven-schema-migration-plan-v10.json` recorded `writes=false`, `ok=true`, and active approval evidence references current post-schema baseline, next-gate v1+, `nextGate=schema`, `nextGateRequestable=true`, and no-write suite v19+.
- `python3 scripts/check-seven-no-write-suite.py --json-report /tmp/speakasap-seven-no-write-suite-v20.json` passed.
- `/tmp/speakasap-seven-no-write-suite-v20.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`, and embedded next-gate summary `nextGate=schema`.
- `git diff --check` passed.

Boundary:

- No target database connection, schema migration, data apply, media copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, public route cutover, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

## 2026-06-13 - Goal 10 Intent Commit Readiness Gate

Status: no-write intent/commit readiness checker added; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Added `scripts/check-seven-intent-commit-readiness.py` to validate the seven intent-preservation evidence and required migration commit block.
- Wired the checker into `scripts/check-seven-no-write-suite.py`.
- The checker verifies legacy evidence, target ownership, preserved typography, required no-write reports, approval boundaries, rollback plan, and required commit-message sections.

Verification:

- `python3 scripts/check-seven-intent-commit-readiness.py --json-report /tmp/speakasap-seven-intent-commit-readiness-v1.json` passed.
- `/tmp/speakasap-seven-intent-commit-readiness-v1.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`; legacy evidence, ownership, style preservation, required reports, approval boundaries, rollback boundary, and commit block assertions all passed.
- `python3 scripts/check-seven-no-write-suite.py --json-report /tmp/speakasap-seven-no-write-suite-v21.json` passed.
- `/tmp/speakasap-seven-no-write-suite-v21.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`, and embedded intent/commit summary `ok=true`.
- `git diff --check` passed.

Boundary:

- No target database connection, schema migration, data apply, media copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, public route cutover, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

## 2026-06-13 - Salary Lesson Duration Rule Target Support

Status: education-service target support added for salary duration calculation; no database migration apply, salary payout, or deployment ran.

Changed:

- Added nullable `duration_seconds` storage to target lesson records through Prisma schema and migration `20260613130000_lesson_record_duration_seconds`.
- Updated lesson record state, upload commit, and merge commit paths to preserve supplied `durationSeconds` / `duration_seconds` values after object validation.
- Updated education internal salary aggregates to use record duration seconds when available: pay actual recorded minutes capped at scheduled lesson length, and pay the full scheduled lesson duration when the recording is within five minutes of the scheduled duration.
- Derived scheduled lesson minutes as 30 for demo lessons, 90 for group lessons, and 60 for normal lessons.
- Kept a warning fallback for existing migrated records whose target lesson record has no duration seconds yet; no legacy payroll duration evidence was imported.

Owner clarification:

- Salary is paid for the minutes the teacher spent with the student according to the lesson record length.
- Small missing duration below the tolerance threshold is ignored, so a correctly conducted near-full lesson receives full scheduled salary.
- Otherwise salary is based on recorded lesson duration.

Verification:

- `cd education-service && npm run test:lesson-records` passed.
- `cd education-service && npm run build` passed and regenerated Prisma client against the new schema.

Boundary:

- No target database migration was applied.
- No salary rows, calculation runs, payout runs, payment disbursements, lesson records, or legacy portal data were mutated.
- No Kubernetes deployment or rollout ran.

Next:

- Apply the education-service Prisma migration only through the approved deployment path, then populate trusted `duration_seconds` for lesson records before running salary aggregate parity again.

## 2026-06-13 - Education Lesson Record Duration Migration And Backfill Gate

Status: approved education schema migration applied; duration backfill utility implemented and verified on one known private media fixture. Mass backfill remains blocked by missing target media objects.

Changed:

- Applied education-service Prisma migration `20260613130000_lesson_record_duration_seconds` to `speakasap_education_db`.
- Added `education-service/scripts/backfill-lesson-record-durations.js` and npm script `backfill:lesson-record-durations`.
- The backfill derives duration from private lesson-record media with `ffprobe`; it does not read legacy payroll duration evidence.
- Backfill apply is write-gated by `--apply --confirm-write --approval-note ... --rollback-plan ...`.
- Added targeted filters `--lesson-uuid` and `--lesson-record-uuid` for surgical verification/retry.

Runtime evidence:

- Temporary `kubectl -n statex-apps port-forward svc/db-server-postgres 5432:5432` was opened for the approved schema apply and DB-backed checks, then stopped.
- `cd education-service && npm run prisma:migrate:deploy` applied `20260613130000_lesson_record_duration_seconds` successfully.
- `/tmp/speakasap-lesson-record-duration-backfill-dry-run-v2.json` recorded `writes=false`, `candidates=96729`, `existingDurationSeconds=0`, sample selected `5`, and sample failures `5` with `http_404`.
- `/tmp/speakasap-lesson-record-duration-known-fixture-dry-run-v1.json` recorded `writes=false`, targeted fixture candidate `1`, probe success `1`, measured duration `12` seconds.
- `/tmp/speakasap-lesson-record-duration-known-fixture-apply-v1.json` recorded `writes=true`, updated `1` row, and rollback SQL `/tmp/speakasap-lesson-record-duration-known-fixture-rollback-v1.sql`.
- `/tmp/speakasap-lesson-record-duration-known-fixture-post-apply-v1.json` recorded `writes=false`, targeted fixture candidates `0`, existing duration rows `1`.
- Post-apply count check recorded `durationRows=1` and `remainingCandidates=96728`.

Verification:

- `cd education-service && npm run build` passed after the backfill script and schema changes.
- `cd education-service && npm run test:lesson-records` passed.
- Scoped `git diff --check` passed after the prior edits.

Boundary:

- No mass duration backfill ran because sampled imported target record objects returned `404`.
- No salary calculation run, payout run, payment/disbursement, legacy portal data mutation, object copy, object deletion, or broad service deployment ran.

Next:

- Resolve lesson-record media availability for imported records, then rerun the duration backfill dry-run at larger sample size before any mass apply.

## 2026-06-13 - Salary-Period Lesson Record Media Repair And Duration Backfill

Status: salary-period media metadata repair and duration backfill applied; 13 salary-period records remain blocked by missing media objects.

Changed:

- Added `education-service/scripts/repair-lesson-record-keys.js` and npm script `repair:lesson-record-keys`.
- Extended `education-service/scripts/backfill-lesson-record-durations.js` with period filters and host-mounted MinIO probing for controlled runtime backfills.
- Repaired lesson-record metadata keys to canonical `YYYY/MM/DD/lesson_<lessonUuid>.mp3` only where the canonical object existed in MinIO.
- Backfilled `duration_seconds` for salary-period lesson records from private MinIO media using `ffprobe`.

Evidence:

- MinIO data source confirmed at host path `/srv/speakasap-records/speakasap-records` through `deployment/minio-microservice` hostPath `/srv/speakasap-records`.
- Full no-write media inventory `/tmp/speakasap-lesson-record-media-inventory-v1.json` recorded `96727` processed records with start/record, `70857` current objects reachable, `557` initially repairable to canonical, and `25313` missing current/canonical objects.
- Key repair apply `/tmp/speakasap-lesson-record-key-repair-apply-v1.json` recorded `writes=true`, `selected=96727`, `attempted=38073`, `canonicalReachable=835`, `wouldUpdate=835`, and `updated=835`.
- Key repair rollback SQL: `/tmp/speakasap-lesson-record-key-repair-rollback-v1.sql`.
- Post-key-repair inventory `/tmp/speakasap-lesson-record-media-inventory-post-key-repair-v1.json` recorded `currentExists=71414`, `repairableToCanonical=0`, and `currentMissingCanonicalMissing=25313`.
- Salary-period duration dry-run `/tmp/speakasap-lesson-record-duration-salary-period-dry-run-v2.json` recorded `writes=false`, `candidates=2433`, sample `succeeded=16`, sample `failed=4`.
- Salary-period duration apply `/tmp/speakasap-lesson-record-duration-salary-period-apply-v1.json` recorded `writes=true`, `candidates=2433`, `attempted=2433`, `succeeded=2420`, `failed=13`, and `updated=2420`.
- Salary-period duration rollback SQL: `/tmp/speakasap-lesson-record-duration-salary-period-rollback-v1.sql`.
- Post-apply dry-run `/tmp/speakasap-lesson-record-duration-salary-period-post-apply-v1.json` recorded `writes=false`, `candidates=13`, `existingDurationSeconds=2421`, `succeeded=0`, `failed=13`, all with `object_missing`.
- Direct salary-period count recorded `with_duration=2420`, `without_duration=13`, `total=2433`.

Verification:

- `cd education-service && npm run test:lesson-records` passed.
- `cd education-service && npm run build` passed.
- `node --check education-service/scripts/backfill-lesson-record-durations.js education-service/scripts/repair-lesson-record-keys.js` passed.

Boundary:

- No salary calculation run, payout run, payment/disbursement, object deletion, legacy portal mutation, or broad service deployment ran.
- Remaining 13 salary-period records require media recovery or an explicit missing-record salary policy decision before full parity can be claimed.

Next:

- Rerun salary aggregate parity against the target duration-aware logic, then isolate the 13 missing-media salary-period lessons and decide recovery versus fallback policy.

## 2026-06-13 - Salary Duration Fixed Tolerance Correction

Status: target salary duration rule corrected from percentage tolerance to the owner-approved fixed five-minute tolerance; parity rerun pending.

Changed:

- Updated education internal salary aggregates to pay full scheduled duration when a record is no more than five minutes shorter than scheduled length.
- Updated salary duration rule version to `salary-duration-v3-record-length-5min-tolerance`.
- Updated salary migration documentation to preserve the owner clarification that small missing minutes are ignored, while larger gaps use recorded duration.

Evidence:

- Read-only parity report `/tmp/speakasap-salary-duration-parity-2025-07_2026-06-v1.json` showed the prior 95% rule underpaid near-full 56-minute records that legacy/imported salary rows paid as full lessons.

Boundary:

- No salary calculation run, payout run, payment/disbursement, lesson-record duration write, object mutation, legacy portal mutation, or deployment ran for this correction.

Next:

- Rebuild and rerun salary duration parity with the fixed five-minute tolerance rule.

## 2026-06-13 - Salary Duration Parity Rerun V2

Status: read-only salary duration parity rerun completed with fixed five-minute tolerance; full salary parity is still blocked by remaining rule/data gaps.

Evidence:

- Read-only report `/tmp/speakasap-salary-duration-parity-2025-07_2026-06-v2.json` used `salary-duration-v3-record-length-5min-tolerance` for periods `2025-07` through `2026-06`.
- Report summary: imported lesson salary rows `2687`, null lesson UUID rows `0`, matched education lessons `2687`, missing education lessons `0`, teacher mismatches `1`, missing-duration fallback rows `286`, row minute mismatches `215`, aggregate mismatches `105`.
- Aggregate totals: imported minutes `157380`, computed minutes `156083`, delta `-1297`.
- Source counts: `record_duration=2394`, `missing_duration_fallback=286`, `demo_without_record=7`.
- The fixed tolerance reduced row minute mismatches from `300` in v1 to `215` in v2.

Remaining blockers:

- Some salary-period lesson records still rely on missing-duration fallback rather than measured media duration.
- Some imported demo lesson salary rows have `qty=0` while the target duration rule currently pays demo recordings; demo salary behavior needs a targeted rule correction or explicit owner approval.
- One imported salary row maps to a target lesson with no target teacher mapping: legacy expense `106749`, lesson `6825eedc-ef4d-482d-8cf3-ff3a3b8cfb6c`.
- Several non-demo records are materially shorter than the five-minute tolerance and therefore compute less than imported legacy salary quantities; these need media/source reconciliation before enabling salary calculation runs.

Verification:

- `cd education-service && npm run test:lesson-records` passed.
- `cd education-service && npm run build` passed.

Boundary:

- The parity rerun was read-only. No salary calculation run, payout run, payment/disbursement, lesson-record duration write, object mutation, legacy portal mutation, deployment, or destructive operation ran.

Next:

- Implement targeted demo salary parity and isolate the remaining missing-duration/short-record/teacher-mapping rows before enabling salary calculation runs or payout flows.

## 2026-06-13 - Goal 10 Worker Evidence Gate

Status: no-write worker/sub-agent evidence checker added; schema/data/media/deploy gates remain approval-blocked.

Changed:

- Added `scripts/check-seven-worker-evidence.py` to validate recorded read-only worker evidence for Anscombe, McClintock, and Huygens.
- Wired the checker into `scripts/check-seven-no-write-suite.py`.
- Updated `docs/orchestrator/SEVEN_INTENT_PRESERVATION_EVIDENCE.md` with the worker findings and boundaries: read-only, no edits, no DB writes, no deploys, and master orchestrator retains final responsibility.

Verification:

- `python3 scripts/check-seven-worker-evidence.py --json-report /tmp/speakasap-seven-worker-evidence-v1.json` passed.
- `/tmp/speakasap-seven-worker-evidence-v1.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`.
- `python3 scripts/check-seven-no-write-suite.py --post-schema-reconciliation-report /tmp/speakasap-seven-post-schema-reconciliation-v1.json --json-report /tmp/speakasap-seven-no-write-suite-v22.json` passed.
- `/tmp/speakasap-seven-no-write-suite-v22.json` recorded `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`.
- `git diff --check` passed.

Boundary:

- No target database connection, schema migration, data apply, media copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, public route cutover, or legacy route retirement ran.

Next:

- Continue to the schema-only approval gate from `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`.

## 2026-06-13 - Goal 10 Schema Operator Language Gap Fix

Status: schema migrations applied; operator adjusted to tolerate expected post-schema missing Language rows before data approval.

Changed:

- Updated `scripts/apply-seven-schema-approved.sh` so the post-schema target report can return non-zero for the expected `TARGET_LANGUAGE_CODES_MISSING` state as long as the report is written.
- Updated `content-service/scripts/check-seven-schema-migration-plan.py` to verify the operator handles that expected language seed gap.
- Updated `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` with the post-schema target-report behavior.

Verification:

- Schema operator was rerun idempotently; `/tmp/speakasap-seven-schema-migrate-deploy.log` recorded no pending migrations after the first successful apply.
- `/tmp/speakasap-seven-schema-apply-execution-v1.json` was written with `writes=true`, `ok=true`, `schemaReady=true`, and `dataReady=false`.
- `/tmp/speakasap-seven-post-schema-reconciliation-v1.json` passed with `writes=false`, `ok=true`, `schemaReady=true`, and next action data with `--include-languages`.
- `git diff --check` passed.

Boundary:

- The only runtime mutation already performed in this approval block was content-service schema migration apply. No seven data apply, media copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, public route cutover, or legacy route retirement ran.

Next:

- Complete post-schema reconciliation evidence, then evaluate the next small approved data block.

## 2026-06-13 - Goal 10 Data Execution Report Format Fix

Status: seven data apply completed; data execution report JSON formatting fixed for runtime evidence.

Changed:

- Fixed `scripts/apply-seven-data-approved.sh` so `/tmp/speakasap-seven-content-apply-execution-v1.json` ends with a real newline, not a literal `\n`.
- Repaired the current execution report written by the successful data apply.

Verification:

- `/tmp/speakasap-seven-runtime-evidence-after-data-v1.json` passed after repairing the data execution report JSON.
- `/tmp/speakasap-seven-no-write-suite-after-data-v2.json` passed after repairing the data execution report JSON.
- `git diff --check` passed.

Boundary:

- Seven content data apply already ran under owner approval with rollback SQL. No media copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, public route cutover, or legacy route retirement ran.


## 2026-06-13 - Goal 10 Schema And Data Gates Executed

Status: schema and seven public content data gates executed under owner approval; media/deploy/legacy-retirement remain blocked.

Changed:

- Applied content-service base and seven Prisma migrations to the Kubernetes content database.
- Reconciled post-schema target state: `schemaReady=true`, `dataReady=false`, missing 19 Language rows as expected before data apply.
- Applied the seven public content data block with `--include-languages`: 19 Language rows, 19 SevenCourse rows, 136 SevenLesson rows, and 429 SevenExercise rows.
- Generated rollback SQL at `/tmp/speakasap-seven-content-rollback-v1.sql`.
- Fixed schema/data operator evidence handling so post-schema language gaps and data execution JSON are represented correctly.

Verification:

- `/tmp/speakasap-seven-schema-migrate-deploy.log` records the schema apply and idempotent retry with no pending migrations.
- `/tmp/speakasap-seven-schema-apply-execution-v1.json` records `writes=true`, `ok=true`, `schemaReady=true`, and `dataReady=false`.
- `/tmp/speakasap-seven-post-schema-reconciliation-v1.json` records `writes=false`, `ok=true`, `schemaReady=true`, `dataReady=false`, and next action data with `--include-languages`.
- `/tmp/speakasap-seven-content-apply-execution-v1.json` records `writes=true`, `ok=true`, rollback plan, apply report, and post-apply report.
- `/tmp/speakasap-seven-content-post-apply-v1.json` records `writes=false`, no blocking issues, and planned matches `19` courses, `136` lessons, `429` exercises.
- `/tmp/speakasap-seven-runtime-evidence-after-data-v1.json` records schema/data requirements true and remaining media/deploy/smoke/visual gates false.
- `/tmp/speakasap-seven-no-write-suite-after-data-v2.json` records `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`, next gate `media`, and `nextGateRequestable=true`.
- `git diff --check` passed.

Boundary:

- No media copy/object mutation, image build/push, Kubernetes rollout, destructive rollback, public route cutover, or legacy route retirement ran.
- Next media gate requires a concrete `MEDIA_TARGET_ROOT` served by `https://assets.alfares.cz/media/...` before running `scripts/copy-seven-media-approved.sh --execute`.

Next:

- Confirm the asset-host filesystem/object target for `MEDIA_TARGET_ROOT`, then run the approved media block.

## 2026-06-13 - Seven Assets Host Gap And Safe Static Host Operator

Status: assets host target gap identified; isolated static host manifest/operator added; no media copy, application deployment, database write, destructive cleanup, or legacy retirement ran.

Evidence:

- Read-only investigation found no existing Kubernetes ingress, nginx route, service registry entry, or confirmed filesystem root for `https://assets.alfares.cz/media/...`.
- `https://assets.alfares.cz/` and a sample `https://assets.alfares.cz/media/pdf/en/lesson1.pdf` currently return `404`.
- MinIO remains private/presigned-only and is not a safe public `/media/...` target.
- Added `k8s/services/assets-service.yaml` for an isolated `speakasap-assets` nginx deployment/service/ingress serving only `/media/...` from read-only hostPath `/home/ssf/speakasap-assets`.
- Added `scripts/apply-seven-assets-host-approved.sh`, a write-gated operator that requires exact approval text, runs server dry-run, applies only the assets manifest, waits only `deployment/speakasap-assets`, and verifies `assets.alfares.cz` marker/missing responses.
- Added `scripts/check-seven-assets-host-readiness.py` and included it in the no-write suite.

Boundary:

- No existing SpeakASAP deployment is restarted by this assets host operator.
- The media copy gate remains separate and must use `/home/ssf/speakasap-assets` only after the assets host execution report is `ok=true`.

Next:

- Run the assets-host readiness check and server dry-run; if clean, execute `scripts/apply-seven-assets-host-approved.sh --execute`, then proceed to media copy with `MEDIA_TARGET_ROOT=/home/ssf/speakasap-assets`.
## 2026-06-13 - Goal 10 Seven Media Copy Runtime Gate Closed

Status: media runtime gate is complete; deploy is the next requestable gate.

Evidence:
- Owner-approved media gate executed in small sequential legacy-source requests. `scripts/copy-seven-media-approved.sh --execute` copied only public seven-course `/media/audio/...` and `/media/pdf/...` refs from `/tmp/speakasap-seven-media-copy-manifest-v3.json` into `/home/ssf/speakasap-assets`.
- `/tmp/speakasap-seven-media-copy-execution-v1.json` records `writes=true`, `ok=true`, `scope=public seven-course audio/pdf media only`, and `copied=1212`. No private media, unrelated media, destructive cleanup, deployment, paid-product change, or legacy route retirement was approved or run.
- The first post-copy availability run exposed checker false negatives from Python `urllib` timeouts against the public assets host. `content-service/scripts/check-seven-media-availability.py` was hardened to use `curl` HEAD with Range fallback, lower default parallelism, and boolean `ok` plus `okCount`.
- `/tmp/speakasap-seven-media-postcopy-v1.json` records `writes=false`, `checked=1212`, `ok=true`, `okCount=1212`, `missing=0`, and public statuses `200/206` from `https://assets.alfares.cz`.
- `/tmp/speakasap-seven-runtime-evidence-after-media-v2.json` records `writes=false`, `ok=true`, `complete=false`, with remaining requirements only `deployExecutionOk`, `deploymentSmokeOk`, and `visualQaOk`.
- `/tmp/speakasap-seven-no-write-suite-after-media-v2.json` records `writes=false`, `ok=true`, `complete=false`; `/tmp/speakasap-seven-next-gate-suite.json` reports `nextGate=deploy`, `nextGateRequestable=true`, and next approval packet `docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md`.

## 2026-06-13 - Goal 10 Deploy Preflight After Media Gate

Status: deploy gate is ready for explicit owner approval; no deployment, image push, or rollout ran.

Evidence:
- `/tmp/speakasap-seven-deployment-readiness-after-media-v1.json` records `writes=false`, `ok=true`, `readyForOwnerDeploymentApproval=true`, `failedAssertions=[]`, and confirms `scripts/deploy-seven-approved.sh` is scoped to `speakasap-content`, `speakasap-api-gateway`, and `speakasap-frontend`.
- Build-only preflight passed and is recorded in `/tmp/speakasap-seven-build-preflight-after-media-v1.json` with `ok=true`, `deployment=false`, `dockerPush=false`, `kubectlRollout=false`, and statuses `contentPrismaValidateAndBuild=0`, `apiGatewayBuild=0`, `frontendBuild=0`. Logs are `/tmp/speakasap-seven-build-preflight-after-media-v1-content.log`, `/tmp/speakasap-seven-build-preflight-after-media-v1-api-gateway.log`, and `/tmp/speakasap-seven-build-preflight-after-media-v1-frontend.log`.
- Current deployment snapshot for rollback evidence is `/tmp/speakasap-seven-predeploy-current-deployments-v1.json`; all three scoped deployments were `1/1` ready before any seven deploy.
- `/tmp/speakasap-seven-deployment-smoke-predeploy-after-media-v1.json` records `writes=false`, `ok=false` as expected before deploy: `health=200`, assets `audioHead=200` and `pdfHead=200`, while seven app routes still return `courseApi/lessonsApi/lessonApi=401` and `coursePage/lessonPage=404`.
- Next action remains explicit deploy approval using `docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md`; without that approval, do not run `scripts/deploy-seven-approved.sh --execute`.

## 2026-06-13 - Goal 10 Deploy Gate Pre-Approval Hardening

Status: deploy remains owner-approval gated; no deployment, image push, or rollout ran.

Evidence:
- `scripts/deploy-seven-approved.sh` refusal path was rechecked. Without `--execute`, it exits `2`, prints usage, and does not start docker or kubectl apply. With wrong `SEVEN_DEPLOY_APPROVAL_TEXT`, it exits `2` before docker or kubectl get.
- `docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md` post-deploy smoke command was aligned with the canonical operator/runtime artifact path: `/tmp/speakasap-seven-deploy-smoke-v1.json`, including `--assets-base-url https://assets.alfares.cz`.
- `/tmp/speakasap-seven-deployment-readiness-after-docfix-v1.json` records `writes=false`, `ok=true`, `readyForOwnerDeploymentApproval=true`.
- `/tmp/speakasap-seven-no-write-suite-after-deploy-docfix-v1.json` records `writes=false`, `ok=true`, `complete=false`, and next gate remains `deploy` with `nextGateRequestable=true`.

## 2026-06-13 - Goal 10 Deploy Failure Evidence Hardening

Status: deploy remains owner-approval gated; no deployment, image push, or rollout ran.

Evidence:
- Hardened `scripts/deploy-seven-approved.sh` with an `ERR` trap. After an approved deploy starts, failures in build, push, frontend deploy, manifest apply, rollout restart/status, or smoke now write `/tmp/speakasap-seven-deploy-execution-v1.json` with `ok=false`, `failureStage`, `exitCode`, `smokeOk`, and links to predeploy/smoke reports.
- The successful path still writes the same canonical execution report and keeps `dataRollbackApproved=false`, `mediaRollbackApproved=false`, and `legacyRetirementApproved=false`.
- Updated `scripts/check-seven-deployment-readiness.py` to require `writesFailureExecutionReport=true` for the deploy operator contract.
- `/tmp/speakasap-seven-deployment-readiness-failure-report-v1.json` records `writes=false`, `ok=true`, `readyForOwnerDeploymentApproval=true`, `failedAssertions=[]`, and deploy operator `writesFailureExecutionReport=true`.
- `/tmp/speakasap-seven-no-write-suite-failure-report-v1.json` records `writes=false`, `ok=true`, `complete=false`, and next gate remains `deploy` with `nextGateRequestable=true`.
- Refusal checks remain safe: without `--execute` the operator exits `2` before docker/kubectl; with wrong `SEVEN_DEPLOY_APPROVAL_TEXT` it exits `2` before docker/kubectl.

## 2026-06-13 - Goal 10 Visual QA Runtime Prepared

Status: post-deploy browser QA runtime is prepared; no deployment, image push, rollout, or production page visual QA ran.

Evidence:
- `alfares` has system Chrome at `/usr/bin/google-chrome` but did not have a Playwright module available to `scripts/check-seven-postdeploy-visual-qa.js`.
- Added `playwright-core` as a frontend dev dependency and hardened `scripts/check-seven-postdeploy-visual-qa.js` to load `playwright` or `playwright-core` from `frontend/node_modules`, then launch system Chrome with `executablePath`.
- Added `--self-test true` mode to the visual QA script. It runs no production network checks; it launches headless Chrome, renders synthetic seven lesson HTML with the preserved legacy typography values, captures a screenshot, and verifies the same computed-style assertions.
- `/tmp/speakasap-seven-visual-qa-contract-runtime-v1.json` records `writes=false`, `ok=true`.
- `/tmp/speakasap-seven-visual-qa-self-test-v1.json` records `writes=false`, `ok=true`, `selfTest=true`, `playwrightModule=/home/ssf/Documents/Github/speakasap/frontend/node_modules/playwright-core`, `executablePath=/usr/bin/google-chrome`, and screenshot `/tmp/speakasap-seven-visual-qa-self-test-v1/self-test-mobile.png`.
- `frontend npm run build` passed after the dependency change; log: `/tmp/speakasap-seven-frontend-build-after-visual-qa-runtime-v1.log`.
- `/tmp/speakasap-seven-no-write-suite-visual-qa-runtime-v1.json` records `writes=false`, `ok=true`, `complete=false`, and next gate remains `deploy` with `nextGateRequestable=true`.

## 2026-06-13 - Goal 10 Visual QA Typography Coverage Hardened

Status: post-deploy browser QA now checks course and lesson typography with viewport-aware expectations; no deployment, image push, rollout, or production page visual QA ran.

Evidence:
- Hardened `scripts/check-seven-postdeploy-visual-qa.js` to collect computed styles from actual rendered lesson text descendants rather than the `.lesson__content--seven` container.
- Added viewport-aware post-deploy assertions for mobile and desktop readable text, table cells, course heading, lesson-card heading, app promo list, h1/h2 legacy colors, and exercise title typography.
- Hardened `scripts/check-seven-visual-qa-contract.py` to require explicit viewport-aware text and table typography markers.
- `/tmp/speakasap-seven-visual-qa-contract-viewport-aware-v1.json` records `writes=false`, `ok=true`, including `checksViewportAwareTextTypography=true` and `checksViewportAwareTableTypography=true`.
- `/tmp/speakasap-seven-visual-qa-self-test-viewport-aware-v1.json` records `writes=false`, `ok=true`, `selfTest=true`, Playwright Core from `frontend/node_modules`, system Chrome `/usr/bin/google-chrome`, and screenshot `/tmp/speakasap-seven-visual-qa-self-test-viewport-aware-v1/self-test-mobile.png`.
- `/tmp/speakasap-seven-no-write-suite-viewport-aware-v1.json` records `writes=false`, `ok=true`, `complete=false`.
- `/tmp/speakasap-seven-next-gate-viewport-aware-v1.json` records `writes=false`, `ok=true`, `nextGate=deploy`, and `nextGateRequestable=true`.

## 2026-06-13 - Goal 10 Current Completion Audit Before Deploy

Status: pre-deploy evidence is current and complete; final goal completion remains blocked on the approved deploy, deployment smoke, and rendered browser typography QA.

Evidence:
- `/tmp/speakasap-seven-next-gate-current-audit-v1.json` records `writes=false`, `ok=true`, `nextGate=deploy`, `nextGateRequestable=true`, and next approval packet `docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md`.
- `/tmp/speakasap-seven-deployment-readiness-current-audit-v1.json` records `writes=false`, `ok=true`, `readyForOwnerDeploymentApproval=true`, and `failedAssertions=[]`.
- `/tmp/speakasap-seven-runtime-evidence-current-audit-v1.json` records `writes=false`, `ok=true`, `complete=false`, with remaining requirements only `deployExecutionOk`, `deploymentSmokeOk`, and `visualQaOk`.
- `/tmp/speakasap-seven-goal-completion-current-audit-v2.json` records all pre-deploy requirements as true: frontend routes implemented, content API implemented, gateway public access contract proven, schema applied/reconciled, data/media gates ready, static typography contract preserved, and post-deploy visual QA contract present.
- The same completion audit records remaining requirements as `postDeployVisualQaPassed`, `runtimeEvidenceChainComplete`, `deploymentSmokePassed`, and `cutoverReady`.
- `/tmp/speakasap-seven-scoped-deployments-current-audit-summary-v1.json` records `writes=false`, `ok=true`; the scoped deployments `speakasap-content`, `speakasap-api-gateway`, and `speakasap-frontend` are all currently `1/1` ready before any seven deploy.

Boundary:
- No deployment, image push, rollout, production page browser QA, data/media rollback, destructive cleanup, or legacy route retirement ran in this audit.

## 2026-06-13 - Goal 10 Intent Evidence Current After Data/Media Gates

Status: intent-preservation and commit-readiness evidence now reflects the actual runtime gate state; deploy remains owner-approval gated.

Evidence:
- Updated `docs/orchestrator/SEVEN_INTENT_PRESERVATION_EVIDENCE.md` so approval status no longer says schema/data/media are unapproved. It now records schema/data/media as approved and executed, with deploy, data/media rollback, destructive cleanup, and legacy route retirement still unapproved.
- Added the exact `/tmp/speakasap-seven-no-write-suite-v21.json` evidence reference required by the intent readiness contract.
- Updated `scripts/check-seven-intent-commit-readiness.py` so the commit-readiness assertion checks the current approval boundary instead of the earlier pre-runtime "no runtime approval used" phrase.
- `/tmp/speakasap-seven-intent-commit-readiness-current-v3.json` records `writes=false`, `ok=true`, `requiredReportsPresent=true`, `approvalBoundariesPresent=true`, and `commitBlockStatesCurrentApprovalBoundary=true`.
- `/tmp/speakasap-seven-no-write-suite-intent-current-v1.json` records `writes=false`, `network=false`, `database=false`, `deployment=false`, intent commit summary `ok=true`, and completion still false only because post-deploy smoke/visual/runtime evidence is pending.

Boundary:
- No deployment, image push, rollout, production page browser QA, data/media rollback, destructive cleanup, or legacy route retirement ran in this evidence update.

## 2026-06-13 - Goal 10 Fresh External Pre-Deploy Smoke

Status: current public runtime still requires the scoped deploy gate; assets are available and the seven app/API routes are still in the expected pre-deploy failure state.

Evidence:
- `/tmp/speakasap-seven-deployment-smoke-predeploy-current-v1.json` records `writes=false`, `ok=false` as expected before deploy.
- The same smoke records `healthOk=true`, `pdfOk=true`, and `audioOk=true` for `https://assets.alfares.cz/media/pdf/en/lesson1.pdf` and `https://assets.alfares.cz/media/audio/en/lesson1.mp3`.
- The same smoke records current seven runtime gaps before deploy: `courseApi/lessonsApi/lessonApi=401` and `coursePage/lessonPage=404`.
- `/tmp/speakasap-seven-next-gate-current-audit-v2.json` records `writes=false`, `ok=true`, `nextGate=deploy`, and `nextGateRequestable=true`.
- `/tmp/speakasap-seven-runtime-evidence-current-audit-v2.json` records `writes=false`, `ok=true`, `complete=false`, with missing requirements only `deployExecutionOk`, `deploymentSmokeOk`, and `visualQaOk`.

Boundary:
- No deployment, image push, rollout, production page browser QA, data/media rollback, destructive cleanup, or legacy route retirement ran in this external smoke audit.

## 2026-06-17 - Goal 9.6 V2 Draft Calculation Review

Status: V2 draft salary calculation review completed; both calculation runs remain draft and payout/payment gates stay closed.

Evidence:

- Reviewed `/tmp/speakasap-salary-calculation-run-2026-05-v2.json`: run `b5d47fb3-e366-4c04-8683-37a51b3c45bf`, period `2026-05`, status `draft`, `lineCount=14`, rules version `salary-duration-v3-imported-legacy-qty-v1`, totals `CZK=29035` and `EUR=21858`.
- Confirmed the V2 draft run matches the post-deploy no-write preview `/tmp/speakasap-salary-calculation-preview-2026-05-postdeploy-v1.json`: `profiles=14`, `lines=14`, `linesUsingImportedLessonSalary=14`, and all `6/6` short-record blocker samples are covered by imported salary expenses.
- Reviewed `/tmp/speakasap-salary-status-after-calculation-v2.json`: `calculationRuns=2`, `payoutRuns=0`, `profilesWithoutAuth=0`, and `lessonExpensesWithoutLessonUuid=0`.
- Reviewed rollback artifact `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v2.sql`; it deletes only `calculation_lines` and the single `calculation_runs` row for run `b5d47fb3-e366-4c04-8683-37a51b3c45bf`.

Boundary:

- No finalize action, payout run, payout commit, payment-service disbursement, persistent env change, rollback execution, deployment, salary/profile mutation, legacy mutation, object-storage mutation, or destructive operation ran in this review.

Next:

- Keep both draft salary calculation runs in `draft`. Finalize, payout, payment execution, rollback, and broad/persistent salary enablement remain blocked pending a separate approval decision.

## 2026-06-21 - Goal 9.6 Salary-Scoped Recording Duration Targeting

Status: code and no-write targeting evidence completed; duration apply, finalize, payout, payment execution, deployment, rollback, object-storage mutation, and destructive actions remain approval-gated.

Changed:

- Added `salary-service/scripts/export-salary-lesson-uuids.ts`, a read-only exporter for imported `SalaryExpenseKind.lesson` lesson UUIDs over a period window.
- Added `npm run export:salary-lesson-uuids` in `salary-service`.
- Extended `education-service/scripts/backfill-lesson-record-durations.js` with `--lesson-uuids` and `--lesson-uuid-report`, so the existing gated duration backfill can target payroll-impacting lesson records instead of generic missing-duration candidates.

Evidence:

- RAG retrieval was reachable but returned empty context/sources for the Goal 9 duration-backfill query; repository and live read-only DB evidence were used.
- Read-only salary export `/tmp/speakasap-salary-lesson-uuids-2025-07_2026-06-goal9.json` recorded `writes=false`, `salaryLessonExpenses=2687`, `withLessonUuid=2687`, `missingLessonUuid=0`, `uniqueLessonUuids=2687`, and `legacyPortalUsers=26`.
- Salary-scoped education duration dry-run smoke `/tmp/speakasap-salary-scoped-duration-backfill-smoke-goal9.json` recorded `writes=false`, `lessonUuidCount=2687`, `candidates=9`, and `selected=1`; the sampled local host-bucket-root probe failed with `object_missing`, which confirms the DB filter/report path but not media availability for that sample.
- Temporary Kubernetes port-forward `127.0.0.1:15436 -> db-server-postgres:5432` was used for read-only DB access and stopped afterward.

Verification:

- `cd education-service && node --check scripts/backfill-lesson-record-durations.js` passed.
- `cd education-service && node scripts/backfill-lesson-record-durations.js --help` passed and showed the new salary-scope flags.
- `cd salary-service && npx tsx scripts/export-salary-lesson-uuids.ts --help` passed.
- `git diff --check` passed.
- `cd education-service && npm run build` passed.
- `cd salary-service && npm run build` passed.

Boundary:

- No salary calculation finalization, payout run, payout commit, payment-service disbursement, education duration apply, deployment, rollback execution, object-storage mutation, legacy mutation, or destructive action ran.
- Future `duration_seconds` writes must use `npm run backfill:lesson-record-durations -- --apply --confirm-write --approval-note ... --rollback-plan ...` and owner approval before writes.

Next:

- Run a full no-write salary-scoped duration probe using `/tmp/speakasap-salary-lesson-uuids-2025-07_2026-06-goal9.json`; then decide recovery for the 9 remaining payroll-impacting duration candidates before any approved apply or salary finalization.

## 2026-06-21 - Goal 9.6 Salary-Scoped Duration Full Probe

Status: full no-write probe completed; recovery approval packet prepared. Duration apply, object-storage mutation, salary finalization, payout creation, payout commit, payment execution, deployment, rollback execution, legacy mutation, and destructive actions remain approval-gated.

Changed:

- Added `docs/orchestrator/SALARY_DURATION_RECOVERY_APPROVAL.md` with separate approval boundaries for applying the two probe-successful durations and for handling seven missing-media rows.

Evidence:

- RAG retrieval was reachable but returned empty context/sources for the recovery query; repository and live no-write evidence were used.
- Full no-write probe `/tmp/speakasap-salary-scoped-duration-full-probe-goal9-v1.json` recorded `writes=false`, `candidates=9`, `selected=9`, `attempted=9`, `succeeded=2`, and `failed=7`.
- Candidate metadata report `/tmp/speakasap-salary-scoped-duration-candidates-goal9-v1.json` recorded `writes=false`, `count=9`, `measured=2`, and `failed=7`.
- Measured duration rows: `93e96231-2bf1-4a66-8273-bc153dbeb9ff` = `9` seconds; `03913255-48ca-470f-8fc1-47a141b7b492` = `30` seconds.
- The seven remaining rows all failed private media probing with `http_404` and still need media recovery or explicit fallback policy approval.
- Live education recording S3 secret values were used only as environment variables for the probe; no secret values were printed or stored in docs.

Boundary:

- No `duration_seconds` apply, object copy/restore/delete, salary calculation finalization, payout run, payout commit, payment-service disbursement, deployment, rollback execution, legacy mutation, or destructive action ran.

Next:

- Review `docs/orchestrator/SALARY_DURATION_RECOVERY_APPROVAL.md`; if approved, run Option A to apply only probe-successful duration rows with rollback SQL, then continue read-only recovery investigation for the seven `http_404` media rows.

## 2026-06-21 - Goal 9.6 Option A Duration Apply

Status: owner-approved Option A completed. Seven salary-scoped private media `http_404` rows remain in read-only recovery. Object mutation, fallback DB writes, salary finalization, payout creation, payout commit, payment execution, deployment, rollback execution, legacy mutation, and destructive actions remain separately approval-gated.

Evidence:

- Apply report `/tmp/speakasap-salary-scoped-duration-apply-goal9-v1.json` recorded `writes=true`, `candidates=9`, `selected=9`, `attempted=9`, `succeeded=2`, `failed=7`, and `updated=2`.
- Rollback SQL was generated at `/tmp/speakasap-salary-scoped-duration-apply-goal9-v1-rollback.sql` and targets only the updated lesson records.
- Updated lesson records: `93e96231-2bf1-4a66-8273-bc153dbeb9ff` = `9` seconds; `03913255-48ca-470f-8fc1-47a141b7b492` = `30` seconds.
- Post-apply no-write probe `/tmp/speakasap-salary-scoped-duration-post-apply-probe-goal9-v1.json` recorded `writes=false`, `candidates=7`, `selected=7`, `attempted=7`, `succeeded=0`, and `failed=7`; all remaining rows are still `http_404`.
- Live education recording S3 secret values were used only as environment variables for probing; no secret values were printed or stored in docs.

Boundary:

- No object-storage copy/restore/delete, fallback DB write, salary calculation finalization, payout run, payout commit, payment-service disbursement, deployment, rollback execution, legacy mutation, or destructive action ran.

Next:

- Continue read-only recovery investigation for the seven remaining `http_404` private media rows, then prepare a separate approval packet for any object restore/copy or fallback policy write.

## 2026-06-21 - Goal 9.6 Read-Only Media Recovery Probe

Status: approved read-only media recovery report completed. The seven salary-scoped private media rows remain unresolved. Object mutation, fallback DB writes, salary finalization, payout creation, payout commit, payment execution, deployment, rollback execution, legacy mutation, and destructive actions remain separately approval-gated.

Evidence:

- Read-only report `/tmp/speakasap-salary-scoped-media-recovery-readonly-goal9-v1.json` recorded `writes=false`, `recordCount=7`, `reachableRecords=0`, and `unresolvedRecords=7`.
- Candidate coverage included current record keys, legacy-prefixed current keys, canonical dated mp3/webm/m4a keys, and legacy-prefixed canonical mp3 keys.
- All `40` candidate object probes returned `http_404`.
- All seven rows have no parts JSON entries and no `education_lessonrecordpart` rows.
- Exact private object keys remain in the `/tmp` report only; durable docs record counts and statuses only.

Boundary:

- No object-storage copy/restore/delete, fallback DB write, salary calculation finalization, payout run, payout commit, payment-service disbursement, deployment, rollback execution, legacy mutation, or destructive action ran.

Next:

- Prepare a separate owner decision: locate a trusted legacy recording-object source and approve a narrow restore/copy, approve an explicit salary fallback policy, or keep these rows blocked.

## 2026-06-21 - Goal 9.6 Option B Missing-Media Salary Fallback Policy

Status: owner selected Option 2 for the seven unresolved salary-scoped private media rows. The fallback policy is documented in `docs/orchestrator/SALARY_MISSING_MEDIA_FALLBACK_POLICY.md`. No fallback DB write, salary calculation run, payout creation, payout commit, payment execution, deployment, rollback execution, object-storage mutation, legacy mutation, or destructive action ran.

Evidence:

- Read-only recovery report `/tmp/speakasap-salary-scoped-media-recovery-readonly-goal9-v1.json` recorded `writes=false`, `recordCount=7`, `reachableRecords=0`, and `unresolvedRecords=7`.
- Read-only coverage check confirmed all seven unresolved lesson UUIDs are present in `/tmp/speakasap-salary-lesson-uuids-2025-07_2026-06-goal9.json`.
- Existing salary-service calculation logic uses imported legacy lesson salary expenses only when all missing/short duration blockers are covered by imported lesson salary rows and no teacher-mapping/dependency warnings remain.

Approved policy:

- Use imported legacy `LessonSalaryExpense.qty` as the authoritative salary quantity for these seven rows.
- Do not synthesize or write `duration_seconds`.
- Keep object recovery and recording-duration parity incomplete for the seven rows.
- Keep salary calculation writes, payouts, payment execution, deployment, rollback execution, object mutation, and legacy mutation behind separate approval gates.

Next:

- Run no-write salary readiness and calculation preview with the imported-lesson-salary fallback policy in force; prepare a separate approval packet before any draft salary calculation run.

## 2026-06-21 - Goal 9.6 Option B No-Write Coverage Validation

Status: no-write validation completed for the owner-approved Option B missing-media salary fallback policy. No salary calculation run, payout creation, payout commit, payment execution, deployment, rollback execution, object-storage mutation, fallback DB write, legacy mutation, or destructive action ran.

Evidence:

- Readiness report `/tmp/speakasap-salary-readiness-2026-05-option2-v1.json` recorded `writes=false`, `rulesVersion=salary-duration-v3-record-length-5min-tolerance`, `missingDurationCount=0`, `shortRecordCount=6`, `teacherMappingMissingCount=0`, and no aggregate warnings. The command exited `2` because source readiness still reports `salaryCalculationReady=false`; this is expected when duration blockers exist.
- Coverage report `/tmp/speakasap-salary-option2-import-coverage-v1.json` recorded `writes=false`, `durationBlockers=6`, `coveredByImportedLessonSalary=6`, `uncovered=0`, `unresolvedRows=7`, `coveredByImportedLessonSalary=7`, and `safeForDraftCalculationApprovalPacket=true`.

Boundary:

- Option B only approves using imported legacy `LessonSalaryExpense.qty` as salary quantity for covered rows.
- Draft salary calculation run creation remains separately approval-gated.
- Payouts, payment execution, deployment, rollback execution, object mutation, fallback DB writes, and legacy mutation remain blocked.

Next:

- Prepare a separate draft salary calculation approval packet using `/tmp/speakasap-salary-option2-import-coverage-v1.json` if the owner wants to create another draft calculation run. Otherwise keep Goal 9 salary finalization blocked.

## 2026-06-21 - Goal 9 Option B Draft Calculation Approval Packet Prepared

Status: approval packet prepared in `docs/orchestrator/SALARY_DRAFT_CALCULATION_APPROVAL_OPTION2.md`. No salary calculation run, payout creation, payout commit, payment execution, deployment, rollback execution, object-storage mutation, fallback DB write, legacy mutation, or destructive action ran.

Evidence:

- Option B coverage report `/tmp/speakasap-salary-option2-import-coverage-v1.json` says `safeForDraftCalculationApprovalPacket=true`.
- Duration blockers covered by imported lesson salary rows: `6/6`.
- Missing-media fallback rows covered by imported lesson salary rows: `7/7`.
- Teacher mapping blockers: `0`.
- Aggregate warnings: none.

Owner action needed:

- Approve, reject, or change the scope of the exact draft calculation write described in `docs/orchestrator/SALARY_DRAFT_CALCULATION_APPROVAL_OPTION2.md`.

Next:

- If approved, run exactly one draft salary calculation for period `2026-05`, capture rollback SQL and JSON reports, and keep payout/payment/deploy/rollback/object/legacy gates closed.
