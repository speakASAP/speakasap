# SpeakASAP Port Allocation (42xx Range)

Reserved port range for SpeakASAP services is **42xx**.

| Service | Port | Notes |
| ------ | ---- | ---- |
| speakasap-content-service | 4201 | Phase 1 |
| speakasap-certification-service | 4202 | Phase 2 |
| speakasap-assessment-service | 4203 | Phase 2 |
| speakasap-course-service | 4205 | Phase 3 |
| speakasap-education-service | 4206 | Phase 3 |
| speakasap-user-service | 4207 | Phase 3 |
| speakasap-payment-service | 4208 | Phase 4 |
| speakasap-notification-service | 4209 | Phase 4 |
| speakasap-api-gateway | 4210 | Phase 5 |
| speakasap-frontend | 4211 | Phase 5 |
| speakasap-salary-service | 4212 | Phase 4 |
| speakasap-financial-service | 4213 | Phase 4 |

Reserved for future speakasap services: **4200, 4204, 4216-4219**. (**4214–4215** are used by the standalone **marathon** app in `marathon/.env`, not `speakasap/.env`.)
