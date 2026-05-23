# SPEC: SpeakASAP Platform

## Overview

SpeakASAP is an online education platform for language learning. Users enroll in courses, complete assessments, earn certifications, and pay for premium content.

## Services

| Service | Port | Role |
|---------|------|------|
| api-gateway | 4210 | Entry point, auth routing |
| course-service | 4201 | Course catalog + enrollment |
| assessment-service | — | Quizzes and scoring |
| certification-service | — | Certificate issuance |
| content-service | 4204 | Lesson content delivery |
| education-service | 4206 | Learning path management |
| financial-service | 4213 | Revenue and billing reporting |
| notification-service | 4209 | Email + push notifications |
| payment-service | 4208 | Checkout (delegates to payments-microservice) |
| salary-service | 4212 | Teacher payout tracking |
| course-materials-service | — | File uploads for course materials |
| frontend | — | React SPA |

## Key Constraints

- All payment processing via `payments-microservice` — never direct Stripe calls from speakasap services
- Student PII is GDPR-sensitive — no logging of personal data
- Deployments via `kubectl rollout restart` or image rebuild + apply (K8s, statex-apps namespace)
- Secrets via Vault → ESO → K8s Secrets

## Success Metrics

- Course completion rate > 60%
- Certification pass rate
- Monthly active learners
- Monthly revenue
