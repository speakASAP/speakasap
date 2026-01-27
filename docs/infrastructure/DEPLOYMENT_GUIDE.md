# SpeakASAP Deployment Guide

This guide explains how to deploy SpeakASAP services using blue/green deployment via nginx-microservice.

## Prerequisites

- Docker and Docker Compose installed
- nginx-microservice installed and configured
- Service registered in nginx-microservice registry
- `.env` file configured with all required environment variables
- `docker-compose.blue.yml` and `docker-compose.green.yml` files created

## Files Required

Each service needs:

1. **`docker-compose.blue.yml`** - Blue environment configuration
2. **`docker-compose.green.yml`** - Green environment configuration
3. **`.env`** - Environment variables (keep synchronized with `.env.example`)
4. **`scripts/deploy.sh`** - Service-specific deployment script (optional, can use base template)

## Container Naming Convention

All services follow the blue/green naming pattern:

- **Blue containers**: `{service-name}-blue` (e.g., `speakasap-content-service-blue`)
- **Green containers**: `{service-name}-green` (e.g., `speakasap-content-service-green`)
- **Shared services**: Database and Redis are shared (no color suffix)

## Port Configuration

All services use ports in the **42xx** range:

- Content Service: `4201`
- Certification Service: `4202`
- Assessment Service: `4203`
- Course Service: `4205`
- Education Service: `4206`
- User Service: `4207`
- Payment Service: `4208`
- Notification Service: `4209`
- API Gateway: `4210`
- Frontend: `4211`
- Salary Service: `4212`
- Financial Service: `4213`

**Note**: These are container ports. Nginx-microservice connects via Docker DNS using container names, not host ports.

## Environment Variables

### Required Variables

Each service `.env` file must include:

```bash
# Service Configuration
SERVICE_NAME=speakasap-content-service
PORT=4201
NODE_ENV=production
DOMAIN=speakasap.com

# Database Configuration (from database-server)
DB_HOST=db-server-postgres
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=your_password_here
DB_NAME=speakasap_content_db
DATABASE_URL=postgresql://dbadmin:password@db-server-postgres:5432/speakasap_content_db

# Shared Microservices
LOGGING_SERVICE_URL=http://logging-microservice:3367
LOGGING_SERVICE_API_PATH=/api/logs
AUTH_SERVICE_URL=http://auth-microservice:3370
NOTIFICATION_SERVICE_URL=http://notifications-microservice:3368
NOTIFICATIONS_MICROSERVICE_URL=http://notifications-microservice:3368
PAYMENTS_MICROSERVICE_URL=http://payments-microservice:3468
AI_SERVICE_URL=http://ai-microservice:3380

# Timeouts and Retries
HTTP_TIMEOUT=5000
GATEWAY_TIMEOUT=30000
AUTH_SERVICE_TIMEOUT=5000
NOTIFICATION_SERVICE_TIMEOUT=10000
LOGGING_SERVICE_TIMEOUT=5000
RETRY_MAX_ATTEMPTS=3
RETRY_DELAY_MS=1000

# CORS and Frontend
CORS_ORIGIN=https://speakasap.com
FRONTEND_URL=https://speakasap.com
```

### .env Sync Process

**Local Development:**

1. Copy `.env.example` to `.env`
2. Fill in all required values
3. Never commit `.env` to git

**Production:**

1. SSH to production server
2. Navigate to service directory
3. Update `.env` with production values
4. Ensure `.env.example` is updated with new variable names (keys only, no values)

## Deployment Process

### Using Deployment Script

```bash
# From service directory
# Service name detected from .env SERVICE_NAME or directory name
./scripts/deploy.sh

# Or specify service name explicitly
./scripts/deploy.sh speakasap-content-service
```

### Manual Deployment

```bash
# 1. Navigate to nginx-microservice directory
cd ~/nginx-microservice

# 2. Run deployment script
./scripts/blue-green/deploy-smart.sh speakasap-content-service
```

## Blue/Green Deployment Flow

1. **Prepare Green**: Builds and starts green containers
2. **Switch Traffic**: Updates nginx configuration to route traffic to green
3. **Monitor Health**: Monitors green deployment for 30 seconds
4. **Cleanup**: Stops old blue containers if green is healthy

### Rollback

If deployment fails, the script automatically:

1. Switches traffic back to blue
2. Stops green containers
3. Logs the error

Manual rollback:

```bash
cd ~/nginx-microservice
./scripts/blue-green/rollback.sh speakasap-content-service
```

## Health Checks

All services must implement a `/health` endpoint that returns:

- `200 OK` when healthy
- Any other status when unhealthy

Health check configuration in docker-compose:

```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:${PORT}/health"]
  interval: 10s
  timeout: 10s
  retries: 2
```

## Docker Compose Template

Use `docker-compose.base.yml` as a template:

1. Copy to service directory
2. Replace `service-name` with actual service name
3. Update environment variables
4. Create `docker-compose.blue.yml` and `docker-compose.green.yml` based on template
5. Ensure container names include `-blue` and `-green` suffixes

## Network Configuration

All services must connect to `nginx-network`:

```yaml
networks:
  nginx-network:
    external: true
    name: nginx-network
```

## Troubleshooting

### Service Not Found in Registry

```bash
cd ~/nginx-microservice
./scripts/add-service-registry.sh speakasap-content-service
```

### Docker Compose Validation Errors

```bash
# Validate blue configuration
docker compose -f docker-compose.blue.yml config

# Validate green configuration
docker compose -f docker-compose.green.yml config
```

### Health Check Failures

1. Check service logs: `docker logs speakasap-content-service-blue`
2. Verify `/health` endpoint responds: `curl http://localhost:4201/health`
3. Check environment variables are set correctly

### Port Conflicts

Ensure ports are unique across all services. Check `docs/infrastructure/PORT_ALLOCATION.md` for port assignments.

## Best Practices

1. **Always validate docker-compose files** before deployment
2. **Keep `.env` synchronized** with `.env.example` (keys only in example)
3. **Test health endpoint** before deploying
4. **Monitor logs** during deployment
5. **Use blue/green naming** consistently
6. **Never hardcode URLs or ports** - use environment variables
7. **Follow marathon service patterns** for consistency

## References

- Port Allocation: `docs/infrastructure/PORT_ALLOCATION.md`
- Shared Services: `docs/infrastructure/SHARED_SERVICES.md`
- Base Template: `docker-compose.base.yml`
- Deployment Script: `scripts/deploy.sh`
- Marathon Reference: `/Users/sergiystashok/Documents/GitHub/marathon`
