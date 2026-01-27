# AGENT13: Content Service Implementation

## Role

Backend Service Agent (Implementation Phase) responsible for implementing the Content Service as a NestJS application.

## Objective

Implement the Content Service as a complete NestJS application with all API endpoints, business logic, database integration, and extensive logging, following marathon service patterns.

---

## Inputs

- `docs/refactoring/CONTENT_API_CONTRACT.md` - API contract (from TASK-12)
- `speakasap/content-service/prisma/schema.prisma` - Prisma schema (from TASK-12)
- `docs/refactoring/CONTENT_DATA_MAPPING.md` - Data mapping (from TASK-12)
- Marathon service as reference: `/Users/sergiystashok/Documents/GitHub/marathon`
- Infrastructure templates: `speakasap/docker-compose.base.yml`, `speakasap/.env.example` (from TASK-11)
- Shared service utilities: `speakasap/docs/infrastructure/SHARED_SERVICES.md` (from TASK-11)

## Scope

- Create complete NestJS application structure
- Implement all API endpoints (GET only - read-only service)
- Implement business logic for content retrieval
- Set up Prisma integration
- Integrate with logging service
- Set up auth guard (if needed for some endpoints)
- Create health endpoint
- Add extensive logging (following marathon pattern)
- Set up error handling
- Create Dockerfile and docker-compose files
- Create deployment script

## Do

- **Create NestJS Application Structure:**

  ```text
  content-service/
  ├── src/
  │   ├── grammar/
  │   │   ├── grammar.controller.ts
  │   │   ├── grammar.service.ts
  │   │   └── grammar.module.ts
  │   ├── phonetics/
  │   ├── dictionary/
  │   ├── songs/
  │   ├── languages/
  │   ├── shared/
  │   │   ├── prisma.service.ts
  │   │   ├── marathon-logger.ts (or content-logger.ts)
  │   │   ├── request-context.middleware.ts
  │   │   └── validate-env.ts
  │   ├── app.module.ts
  │   ├── app.controller.ts
  │   └── main.ts
  ├── prisma/
  │   └── schema.prisma
  ├── Dockerfile
  ├── docker-compose.blue.yml
  ├── docker-compose.green.yml
  ├── .env.example
  └── scripts/
      └── deploy.sh
  ```

- **Implement Controllers:**
  - Grammar controller with list and detail endpoints
  - Phonetics controller with list and detail endpoints
  - Dictionary controller with search and detail endpoints
  - Songs controller with list and detail endpoints
  - Languages controller with list and detail endpoints
  - Health controller (excluded from prefix)
  - Add extensive logging at entry points

- **Implement Services:**
  - Grammar service with filtering logic
  - Phonetics service with filtering logic
  - Dictionary service with search logic
  - Songs service with filtering logic
  - Languages service
  - Add extensive logging for database queries
  - Add extensive logging for business logic

- **Set Up Prisma:**
  - Create Prisma service (following marathon pattern)
  - Initialize Prisma client
  - Handle connection lifecycle
  - Add logging for database queries

- **Integrate Logging:**
  - Use centralized logging service
  - Add logging to all controllers (entry, response)
  - Add logging to all services (queries, processing)
  - Log request context (method, path, IP, user ID if available)
  - Log performance metrics (latency, response sizes)

- **Set Up Error Handling:**
  - Standardized error responses
  - 404 handling (NotFoundException)
  - 400 handling (BadRequestException)
  - 500 handling (InternalServerErrorException)
  - Log all errors with stack traces

- **Create Docker Configuration:**
  - Dockerfile (multi-stage build, node:22-alpine)
  - docker-compose.blue.yml (blue deployment)
  - docker-compose.green.yml (green deployment)
  - Health check configuration
  - Environment variable injection

- **Create Deployment Script:**
  - Follow marathon deployment pattern
  - Integrate with nginx-microservice
  - Blue/green deployment support
  - Rollback on failure

- **Environment Configuration:**
  - Create `.env.example` with all required keys
  - Port: 4201
  - Database: `speakasap_content_db`
  - Logging service URL
  - AI service URL (for TASK-15 integration)

- **Add Extensive Logging:**
  - Controller entry logging (request details)
  - Service method logging (parameters, processing)
  - Database query logging (filters, results, latency)
  - Response generation logging (item counts, pagination)
  - Error logging (full stack traces)
  - Follow marathon service logging patterns

## Do Not

- Do not create write endpoints (read-only service)
- Do not modify shared microservices
- Do not hardcode configuration values
- Do not create automated tests
- Do not create dev environment
- Do not skip logging integration
- Do not create database migrations (that's TASK-14)
- Do not implement AI integration (that's TASK-15)

## Outputs

### Required Files

1. **`speakasap/content-service/src/`** - Complete NestJS application
   - All controllers implemented
   - All services implemented
   - Shared modules (Prisma, logging, auth)
   - Main application file

2. **`speakasap/content-service/Dockerfile`**
   - Multi-stage build
   - node:22-alpine base
   - OpenSSL compatibility
   - Production optimizations

3. **`speakasap/content-service/docker-compose.blue.yml`**
   - Blue deployment configuration
   - Health checks
   - Environment variables
   - Network configuration

4. **`speakasap/content-service/docker-compose.green.yml`**
   - Green deployment configuration
   - Same as blue but different container names

5. **`speakasap/content-service/.env.example`**
   - All required environment variables
   - Port: 4201
   - Database configuration
   - Logging service URL
   - AI service URL

6. **`speakasap/content-service/scripts/deploy.sh`**
   - Deployment script
   - nginx-microservice integration
   - Blue/green deployment
   - Rollback handling

7. **`speakasap/content-service/README.md`**
   - Service documentation
   - Setup instructions
   - API endpoint documentation
   - Deployment instructions

8. **`speakasap/content-service/nginx-api-routes.conf`**
   - Nginx route configuration
   - Domain: `content.statex.cz` (or appropriate domain)
   - Port mapping

### Optional Files

- `speakasap/content-service/tsconfig.json` - TypeScript configuration
- `speakasap/content-service/package.json` - Dependencies

## Exit Criteria

- ✅ All API endpoints implemented
- ✅ Service compiles without errors
- ✅ Health endpoint works (`GET /health`)
- ✅ Logging integrated and working
- ✅ Error handling standardized
- ✅ Docker configuration ready
- ✅ Deployment script ready
- ✅ Extensive logging added (following marathon pattern)
- ✅ Service can be deployed

## Verification

1. **Build and Run:**

   ```bash
   cd speakasap/content-service
   docker compose build
   docker compose up -d
   curl http://localhost:4201/health
   # Should return: {"status":"ok"}
   ```

2. **Test Endpoints:**

   ```bash
   curl http://localhost:4201/api/v1/languages
   curl http://localhost:4201/api/v1/grammar?limit=10
   # Should return appropriate responses
   ```

3. **Check Logging:**

   ```bash
   docker compose logs content-service
   # Should show extensive logging
   ```

## Related

- Design task: `docs/agents/AGENT12_CONTENT_DESIGN.md` (TASK-12)
- Migration task: `docs/agents/AGENT14_CONTENT_MIGRATION.md` (TASK-14)
- AI integration task: `docs/agents/AGENT15_AI_INTEGRATION.md` (TASK-15)
- Phase 1 task: `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md` (TASK-13)
- Marathon reference: `/Users/sergiystashok/Documents/GitHub/marathon`
- Tasks index: `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md`
