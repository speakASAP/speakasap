# SpeakASAP Platform

Foundation repository for the SpeakASAP refactoring program. This repo hosts
shared documentation, infrastructure templates, and service scaffolding used by
Phase 1+ services.

## Structure

```text
speakasap/
├── README.md                    # This file
├── docker-compose.yml           # Base Docker Compose template
├── docker-compose.blue.yml      # Blue environment (all services)
├── docker-compose.green.yml     # Green environment (all services)
├── .env.example                 # Environment variables template
├── scripts/
│   └── deploy.sh                # Deployment script template
├── shared/                      # Shared utilities
│   └── notifications/           # Notification client
└── docs/
    ├── agents/                  # Agent task definitions
    ├── infrastructure/          # Infrastructure documentation
    │   ├── SHARED_SERVICES.md
    │   ├── PORT_ALLOCATION.md
    │   └── DEPLOYMENT_GUIDE.md
    └── refactoring/             # Refactoring plans and tasks
```

## Quick Start

### 1. Create a New Service

1. Copy `docker-compose.yml` to your service directory
2. Replace `service-name` with your actual service name
3. Create `docker-compose.blue.yml` and `docker-compose.green.yml` based on the template
4. Update container names to include `-blue` and `-green` suffixes

### 2. Configure Environment

1. Copy `.env.example` to `.env` in your service directory
2. Fill in all required values (see `docs/infrastructure/SHARED_SERVICES.md`)
3. Never commit `.env` to git
4. Keep `.env.example` updated with variable names (keys only, no values)

### 3. Deploy Service

```bash
./scripts/deploy.sh
```

## Port Allocation

All services use ports in the **42xx** range:

| Service | Port | Phase |
| ------- | ---- | ----- |
| Content Service | 4201 | Phase 1 |
| Certification Service | 4202 | Phase 2 |
| Assessment Service | 4203 | Phase 2 |
| Course Service | 4205 | Phase 3 |
| Education Service | 4206 | Phase 3 |
| User Service | 4207 | Phase 3 |
| Payment Service | 4208 | Phase 4 |
| Notification Service | 4209 | Phase 4 |
| API Gateway | 4210 | Phase 5 |
| Frontend | 4211 | Phase 5 |
| Salary Service | 4212 | Phase 4 |
| Financial Service | 4213 | Phase 4 |

See `docs/infrastructure/PORT_ALLOCATION.md` for complete details.

## Shared Services

All services integrate with shared microservices:

- **Auth Microservice** (`AUTH_SERVICE_URL`) - JWT validation, user identity
- **Database Server** (`DB_HOST`) - PostgreSQL + Redis (shared)
- **Logging Microservice** (`LOGGING_SERVICE_URL`) - Centralized logging
- **Notifications Microservice** (`NOTIFICATIONS_MICROSERVICE_URL`) - Email/Telegram/WhatsApp
- **Payments Microservice** (`PAYMENTS_MICROSERVICE_URL`) - Payment processing
- **AI Microservice** (`AI_SERVICE_URL`) - AI-powered translations and content

See `docs/infrastructure/SHARED_SERVICES.md` for connection details.

## Deployment

Deployments use blue/green deployment via nginx-microservice:

1. **Prepare Green**: Builds and starts green containers
2. **Switch Traffic**: Updates nginx to route to green
3. **Monitor Health**: Monitors for 30 seconds
4. **Cleanup**: Stops old blue containers if healthy

See `docs/infrastructure/DEPLOYMENT_GUIDE.md` for complete deployment instructions.

## Docker Compose Templates

### Base Template

`docker-compose.yml` provides a template following marathon service patterns:

- Multi-stage build support
- Blue/green deployment ready
- Health checks configured
- Environment variable injection
- nginx-network integration

### Usage

1. Copy `docker-compose.yml` to service directory
2. Replace `service-name` with actual service name
3. Update environment variables
4. Create blue and green variants

## Environment Variables

### Required Variables

- `SERVICE_NAME` - Service identifier
- `PORT` - Service port (42xx range)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Database connection
- `LOGGING_SERVICE_URL` - Centralized logging endpoint
- `DATABASE_URL` - Full database connection string

### Optional Variables

- `AUTH_SERVICE_URL` - If service needs authentication
- `NOTIFICATION_SERVICE_URL` - If service sends notifications
- `AI_SERVICE_URL` - If service uses AI features
- Timeout and retry configurations

See `.env.example` for complete list.

## Best Practices

1. **Use environment variables** - Never hardcode URLs or ports
2. **Follow naming conventions** - Blue/green container suffixes
3. **Implement health checks** - `/health` endpoint required
4. **Keep .env synced** - Update `.env.example` with new variables (keys only)
5. **Validate before deploy** - Test docker-compose files
6. **Follow marathon patterns** - Consistency across services
7. **Use shared utilities** - Leverage `shared/` directory

## Documentation

- **Deployment Guide**: `docs/infrastructure/DEPLOYMENT_GUIDE.md`
- **Port Allocation**: `docs/infrastructure/PORT_ALLOCATION.md`
- **Shared Services**: `docs/infrastructure/SHARED_SERVICES.md`
- **Refactoring Plans**: `docs/refactoring/`
- **Agent Tasks**: `docs/agents/`

## Notes

- **Production-only workflows** - No dev environment configs
- **Centralized logging** - All services use `LOGGING_SERVICE_URL`
- **Port range**: 42xx reserved for SpeakASAP services
- **Blue/green deployment** - Zero-downtime deployments via nginx-microservice
- **Marathon patterns** - Follow marathon service structure for consistency

## References

- Marathon Service: `/Users/sergiystashok/Documents/GitHub/marathon`
- nginx-microservice: Integration patterns and deployment scripts
- Phase 1 Tasks: `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md`
