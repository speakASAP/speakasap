# SpeakASAP Orchestrator Specification

## Platform

`speakasap` is an online language-learning platform focused on courses, assessments, certifications, and payments. It is in the refactoring phase from legacy speakasap-portal.

## Runtime and stack

- **Ports:** 42xx range across multiple NestJS services
- **Backend stack:** NestJS microservices
- **Data layer:** PostgreSQL and Redis

## Core integrations

- `auth-microservice:3370`
- `payments-microservice:3468`
- `notifications-microservice:3368`

## Service modules

- content
- certification
- assessment
- course
- education
- user
- payment
- notification
- api-gateway

## AI task types

The orchestrator can generate and schedule the following tasks:

- `generate_course_description`  
  AI-generated course descriptions for active courses.
- `generate_assessment_feedback`  
  Personalized student feedback after assessment completion.
- `send_completion_email`  
  Certification completion email sent via notifications-microservice.

## Constraints

- Never modify student assessment results.
- Payment processing must happen only through payments-microservice.
- GDPR: no student data export without explicit approval.
- Use free/cheap tier models only; no premium LLM calls.
- Monthly LLM budget cap: 200k units.
