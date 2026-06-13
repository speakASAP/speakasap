# Frontend Route Verification

Date: 2026-06-13
Goal: 6.2 - frontend routes for migrated workflows through the API gateway.

## Implemented Routes

- `/learner/lessons/[lessonUuid]/record`: learner lesson-record state, playback token, and range verification controls.
- `/teacher/lessons/[lessonUuid]/record`: teacher lesson-record state, playback token, range verification, and upload presign controls.
- `/learner` and `/teacher` now open the dynamic lesson-record route for a supplied lesson UUID.

## Boundary Decision

The frontend routes call only gateway paths under `/api/v1/lessons/:lessonUuid/record...`. They do not call education-service directly and do not store permanent media URLs. The range check uses the scoped playback download URL returned by the gateway. Destructive commit, merge, and delete actions are intentionally not exposed as route controls because they mutate lesson-record metadata or private objects and require explicit scoped approval before use.

## Verification Evidence

- RAG retrieval failed with curl exit code 6; repository/runtime evidence was used.
- `frontend && npm run build` passed and listed the new dynamic routes.
- `./scripts/deploy-frontend.sh` built and pushed `localhost:5000/speakasap-frontend:latest` with final digest `sha256:d1c0c00fb01cf82a1355b72dc8ddedc5c2aec0c1d1cd910fadf68937e09ef402`.
- `deployment/speakasap-frontend` rolled out successfully; final pod `speakasap-frontend-868bcd6458-zwh5l` was `1/1 Running`, restarts `0`, with clean Next.js startup logs.
- Immediate post-rollout public root smoke twice returned transient Cloudflare `502`; delayed retry after endpoint settlement returned `HTTP/2 200`. `scripts/deploy-frontend.sh` now retries smoke checks to account for that propagation window.
- Public delayed smoke returned `HTTP/2 200` for `/`, `/learner/lessons/test-lesson/record`, and `/teacher/lessons/test-lesson/record`.
- Public delayed smoke returned `HTTP/2 401` for `/api/v1/lessons/test-lesson/record`, confirming protected gateway routing remains enforced.
- Browser QA on desktop verified learner route identity, nonblank rendering, no console errors/warnings, missing-token client validation, and dummy-token gateway `401` for `/api/v1/lessons/test-lesson/record`.
- Browser QA on desktop verified teacher route identity, nonblank rendering, no console errors/warnings, visible upload presign control, visible destructive-action exclusion note, and dummy-token gateway `401` for `/api/v1/lessons/test-lesson/record/presign`.
- Browser QA on mobile viewport `390x844` initially found horizontal clipping; responsive `min-w-0`, heading wrap, and result overflow fixes were applied. Recheck passed without clipping and with no console errors/warnings.

## Remaining Risk

- Authorized happy-path playback and teacher presign were not run because no fresh real user JWT was used in browser QA.
- Commit, merge, and delete remain intentionally untested in frontend because they can mutate metadata or private objects.
- Current frontend dependency tree still reports npm audit findings from prior deployment evidence; remediation remains a separate dependency/security chunk.
