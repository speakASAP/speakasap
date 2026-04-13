# SpeakASAP Port and Database Allocation (42xx Range)

Reserved port range for SpeakASAP services is **42xx**. **Authoritative** mapping of each listed service to its default **HTTP port** and **PostgreSQL database name** on the shared `database-server` (per-service `*_DATABASE_URL` and/or `DB_NAME` as documented in `speakasap/.env.example`). `speakasap/.env.example` and `docker-compose.template.yml` should match this table unless a task explicitly documents a temporary exception.

**speakasap-notification-service:** database name `speakasap_notification_db` is configured only inside **`NOTIFICATION_DATABASE_URL`** (full connection URL). There is no separate `NOTIFICATION_DB_NAME` variable.

| Service | Port | PostgreSQL database | Notes |
| ------ | ---- | -------------------- | ---- |
| speakasap-content-service | 4201 | `speakasap_content_db` | Phase 1 |
| speakasap-certification-service | 4202 | `speakasap_certification_db` | Phase 2 |
| speakasap-assessment-service | 4203 | `speakasap_assessment_db` | Phase 2 |
| speakasap-course-service | 4205 | `speakasap_course_db` | Phase 3 |
| speakasap-education-service | 4206 | `speakasap_education_db` | Phase 3 |
| speakasap-user-service | 4207 | `speakasap_user_db` | Phase 3 |
| speakasap-payment-service | 4208 | `speakasap_payment_db` | Phase 4 |
| speakasap-notification-service | 4209 | `speakasap_notification_db` | Phase 4 |
| speakasap-api-gateway | 4210 | — | Phase 5; no dedicated service DB (routing only) |
| speakasap-frontend | 4211 | — | Phase 5; no dedicated service DB |
| speakasap-salary-service | 4212 | `speakasap_salary_db` | Phase 4 |
| speakasap-financial-service | 4213 | `speakasap_financial_db` | Phase 4 |

Reserved for future speakasap services: **4200, 4204, 4216-4219**. (**4214–4215** are used by the standalone **marathon** app in `marathon/.env`, not `speakasap/.env`.)
