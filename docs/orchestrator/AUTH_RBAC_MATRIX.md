# SpeakASAP Auth And RBAC Matrix

Date: 2026-06-12

Status: Goal 3.4 complete at route-group level.

## Auth Ownership Rule

`auth-microservice` owns identity and JWT validation. `api-gateway` validates bearer tokens and forwards authenticated requests. SpeakASAP services own domain-specific authorization.

## Auth Modes

## Route-Group RBAC Matrix

## Legacy Public Routes

Public marketing/legal/static routes from `speakasap_site`, `redirecter`, `robots.txt`, and legal templates should be implemented in `frontend` or ingress/nginx, not as protected gateway APIs unless they need dynamic private data.

## High-Risk Gates

Owner approval or explicit implementation-goal acceptance criteria required before changing:

- payment webhooks or external payment processing behavior
- private lesson recordings or MinIO object deletion
- student personal data exports or destructive writes
- salary/financial reporting and payouts
- auth/login/JWT behavior
- legacy data deletion or cutover

## Verification Requirements

Each code-bearing implementation chunk must include:

- unauthorized check (`401`)
- authenticated but unauthorized check (`403`)
- not-found/private-resource check (`404`) where relevant
- one authorized happy path
- log/status evidence with actor, route, and decision

Lesson-recording-specific checks are detailed in `LESSON_RECORDING_CONTRACT.md`.
