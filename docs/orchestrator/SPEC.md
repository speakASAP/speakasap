# SpeakASAP — Orchestrator SPEC

**Version:** 1.0 | **Created:** 2026-04-15 | **Owner:** Lead Orchestrator

## Platform Overview

SpeakASAP is an online language-learning platform providing structured courses, progress-based assessments, and certifications. Users enrol in language courses, complete lessons and assessments, and earn certifications on completion.

**Tech stack:** NestJS microservices (ports 42xx), PostgreSQL, Redis, RabbitMQ  
**Key services:** api-gateway, course-service, assessment-service, certification-service, user-service, payment-service, notification-service

## Business Goals

1. Automate course content quality — AI generates + reviews course descriptions
2. Personalise student retention — AI sends contextual feedback after assessments
3. Certify at scale — auto-generate completion emails + certificates

## AI Task Types

| Type | Tier | Description |
|------|------|-------------|
| `generate_course_description` | cheap | Generate SEO-friendly course description from title + syllabus |
| `review_course_content` | cheap | Check course content for factual accuracy + completeness |
| `generate_assessment_feedback` | cheap | Personalised feedback based on student's assessment answers |
| `generate_completion_email` | cheap | Craft personalised congratulations email on certification |
| `analyse_retention_risk` | cheap | Flag students with low engagement based on activity data |

## Constraints

- **No premium tier** — free/cheap models only
- **Budget cap:** 200,000 LLM units/month (separate from flipflop quota)
- **No student data export** without explicit human approval via goal
- **No direct DB access from agents** — all reads via speakasap REST API
- **No email sends without notification-service** — never call SMTP directly

## Integration Points

| Service | Purpose |
|---------|---------|
| `ai-microservice:3380` | All LLM calls (POST /ai/complete, tier=cheap) |
| `notifications-microservice:3340` | Email + Telegram sends |
| `speakasap/api-gateway` | REST API for course/student/assessment data |

## Key Invariants

- All tasks must have a `goal_id` (coordinator enforces)
- Agent outputs must pass validation before task is marked done
- Goal pipeline: course content → student retention → analytics
