# Salary Duration Recovery Approval - Goal 9.6

Date: 2026-06-21

Status: approval packet prepared; no duration apply, object mutation, salary finalization, payout, payment execution, deployment, rollback, legacy mutation, or destructive action is approved by this document.

## Preserved Intent

Goal 9 must preserve legacy teacher payroll parity where salary depends on lesson-recording duration, while keeping private recording objects under `education-service`/MinIO control and keeping salary finalization, payout creation, and payment execution behind separate gates.

## Current No-Write Evidence

- Salary lesson UUID source report: `/tmp/speakasap-salary-lesson-uuids-2025-07_2026-06-goal9.json`.
- Full salary-scoped duration probe: `/tmp/speakasap-salary-scoped-duration-full-probe-goal9-v1.json`.
- Candidate metadata report: `/tmp/speakasap-salary-scoped-duration-candidates-goal9-v1.json`.
- Probe result: `writes=false`, candidates `9`, attempted `9`, succeeded `2`, failed `7`.
- Successful measured durations:
  - lessonRecord `93e96231-2bf1-4a66-8273-bc153dbeb9ff`, lesson `e938bfe3-1e26-4bfe-b992-b27e540c0893`: `9` seconds, lesson start `2025-09-08T10:00:00.000Z`, teacher `332`.
  - lessonRecord `03913255-48ca-470f-8fc1-47a141b7b492`, lesson `1503aa18-3701-494c-98f7-2e673f62f6e9`: `30` seconds, lesson start `2026-02-13T15:00:00.000Z`, teacher `227`.
- Missing target media failures (`http_404`):
  - lessonRecord `9262be4a-d222-4cbb-9799-b054a2863b27`, lesson `3dbd2788-cd97-4a2e-b0da-74c8e9ed94df`, lesson start `2025-07-09T12:00:00.000Z`, teacher `512`, module `course_materials.data.ru.fr._demo.Module1`.
  - lessonRecord `b8e7a2ed-5b30-4104-a523-521ef3ab639a`, lesson `ab311558-2b0d-4f02-97d8-ac08268d9381`, lesson start `2025-07-29T08:00:00.000Z`, teacher `512`, module `course_materials.data.ru.fr._basic_s.Module2T`.
  - lessonRecord `24479d3e-55e6-4048-8c92-ae21d657989b`, lesson `e59bbdef-ddfc-4898-a90b-959785e9898c`, lesson start `2025-11-28T07:00:00.000Z`, teacher `545`, module `course_materials.data.extra_lessons.ModuleExtraLessonsCourse`.
  - lessonRecord `b5f8421e-1b3f-4507-9e33-b23a9195fcf2`, lesson `f111f7c5-ab67-481e-b56a-829605f9db64`, lesson start `2025-12-11T17:00:00.000Z`, teacher `262`, module `course_materials.data.ru.de._basic_n.Module5T`.
  - lessonRecord `44897b74-b935-4d84-a50b-911ba1ad8361`, lesson `69f0931e-0040-4560-8d46-5e19ef46d4bb`, lesson start `2026-01-08T15:00:00.000Z`, teacher `270`, module `course_materials.data.ru.en._basic_n.Module7P`.
  - lessonRecord `38bf0673-c451-4da1-b28c-b976f1b5ee72`, lesson `39cc57e8-a7cc-4ad6-98b0-7b179e9b0c5e`, lesson start `2026-03-07T19:04:00.000Z`, teacher `182`, module `course_materials.data.extra_lessons.ModuleExtraLessonsCourse`.
  - lessonRecord `39179b1d-da3e-4038-b5bf-da36b72e1e05`, lesson `24a3c413-23b8-495c-8f05-3ca350090e26`, lesson start `2026-03-12T13:08:00.000Z`, teacher `182`, module `course_materials.data.extra_lessons.ModuleExtraLessonsCourse`.

## Approval Option A - Apply Only Probe-Successful Durations

This option updates `education_lessonrecord.duration_seconds` only for salary-scoped records whose private media probe succeeds under the existing write gate. Based on the current probe, that should update two rows and leave the seven `http_404` rows untouched.

Approval text:

```text
Approved to run the Goal 9.6 salary-scoped lesson-record duration backfill apply using /tmp/speakasap-salary-lesson-uuids-2025-07_2026-06-goal9.json, updating only private-media probe-successful education_lessonrecord.duration_seconds rows, generating rollback SQL before writes, and creating a JSON apply report. No object-storage mutation, salary run finalization, payout creation, payout commit, payment-service disbursement, deployment, rollback execution, legacy mutation, or destructive action is approved.
```

Proposed command shape after approval:

```bash
cd /home/ssf/Documents/Github/speakasap/education-service
npm run backfill:lesson-record-durations -- \
  --apply \
  --confirm-write \
  --approval-note "<exact owner approval text>" \
  --rollback-plan /tmp/speakasap-salary-scoped-duration-apply-goal9-v1-rollback.sql \
  --lesson-uuid-report /tmp/speakasap-salary-lesson-uuids-2025-07_2026-06-goal9.json \
  --json-report /tmp/speakasap-salary-scoped-duration-apply-goal9-v1.json
```

Required post-apply evidence:

- Apply report shows `writes=true`, expected updated count, and unchanged seven `http_404` failures.
- Rollback SQL exists and targets only rows updated by the approved command.
- No payout/finalize/payment/deploy/object mutation occurred.
- Rerun no-write salary-scoped duration probe after apply.

## Approval Option B - Missing Media Recovery

The seven `http_404` rows still require a separate recovery decision. Possible recovery paths are:

1. Locate original legacy recording objects and copy/restore only those seven private recording objects into the target bucket.
2. Approve an explicit salary fallback policy for those lesson rows while preserving imported historical salary expense quantities.
3. Keep them blocked and exclude broader duration parity claims until media is recovered.

No missing-media object copy, fallback DB write, salary finalization, payout, or payment action is approved by this packet.

## Current Recommendation

Do not finalize salary runs or create payouts. First decide whether to approve Option A for the two probe-successful duration rows, then continue read-only recovery investigation for the seven `http_404` media rows.

## Option A Execution Evidence

Status: Option A was approved by the owner and executed on 2026-06-21.

- Apply report: `/tmp/speakasap-salary-scoped-duration-apply-goal9-v1.json`.
- Rollback SQL: `/tmp/speakasap-salary-scoped-duration-apply-goal9-v1-rollback.sql`.
- Post-apply no-write probe: `/tmp/speakasap-salary-scoped-duration-post-apply-probe-goal9-v1.json`.
- Apply result: `writes=true`, `candidates=9`, `selected=9`, `attempted=9`, `succeeded=2`, `failed=7`, `updated=2`.
- Updated durations: lessonRecord `93e96231-2bf1-4a66-8273-bc153dbeb9ff` = `9` seconds; lessonRecord `03913255-48ca-470f-8fc1-47a141b7b492` = `30` seconds.
- Post-apply result: `writes=false`, `candidates=7`, `selected=7`, `attempted=7`, `succeeded=0`, `failed=7`.

Boundary after execution: the seven `http_404` media rows remain unresolved. No object-storage mutation, fallback DB write, salary finalization, payout creation, payout commit, payment-service disbursement, deployment, rollback execution, legacy mutation, or destructive action was approved or run.

## Read-Only Media Recovery Probe Evidence

Status: the owner approved a read-only live DB/media-key recovery report for the seven remaining `http_404` rows, and it ran on 2026-06-21.

- Report: `/tmp/speakasap-salary-scoped-media-recovery-readonly-goal9-v1.json`.
- Result: `writes=false`, `recordCount=7`, `reachableRecords=0`, `unresolvedRecords=7`.
- Candidate coverage: current record keys, legacy-prefixed current keys, canonical dated mp3/webm/m4a keys, and legacy-prefixed canonical mp3 keys.
- Probe outcome: all `40` candidate object probes returned `http_404`.
- Row shape: all seven rows have no parts JSON entries and no `education_lessonrecordpart` rows.

Boundary after report: exact private object keys remain in the `/tmp` report only. No object-storage mutation, fallback DB write, salary finalization, payout creation, payout commit, payment-service disbursement, deployment, rollback execution, legacy mutation, or destructive action was approved or run.
