# System: speakasap

## Architecture

NestJS microservices (42xx range) + PostgreSQL + Redis. Multiple internal services.

- Services: content, certification, assessment, course, education, user, payment, notification, API gateway

## Integrations

| Service | Usage |
|---------|-------|
| auth-microservice:3370 | User auth |
| database-server:5432 | PostgreSQL + Redis |
| logging-microservice:3367 | Logs |
| notifications-microservice:3368 | Student emails |
| payments-microservice:3468 | Course payments |

## Current State

Stage: active

## Known Issues

- None
