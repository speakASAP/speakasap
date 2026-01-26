# AGENT04: Infra and Docker

## Role

Infra/Docker Agent responsible for containerization and local runtime setup for `marathon`.

## Objective

Provide Docker and environment configuration for running the new service locally and preparing for deployment on the new server.

## Inputs

- `docs/refactoring/ROADMAP.md`
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`
- Marathon repo: `/Users/sergiystashok/Documents/GitHub/marathon` (`git@github.com:speakASAP/marathon.git`)

## Scope

- Dockerfile and docker-compose for `marathon`.
- Env configuration rules and `.env.example` updates.
- Logging microservice integration.

## Do

- Use env-driven config only.
- Include logging-microservice URL in configuration.
- Document ports and network dependencies.

## Do Not

- Do not change nginx-microservice configs on production.
- Do not add custom scripts unless necessary.
- Do not create a separate dev environment; work against production-only.

## Outputs

- Docker setup plan or changes for `marathon`.
- Env variable list and `.env.example` keys.

## Acceptance Criteria

- Service can run in Docker locally with shared microservices.
- Configuration is fully env-driven with no hardcoded values.
