# AGENT11: Infrastructure Setup and Foundation

## Role

Infra/Docker Agent responsible for setting up the `speakasap` project infrastructure foundation for all Phase 1+ services.

## Objective

Create the project structure, Docker configuration templates, shared microservice connection utilities, and deployment infrastructure to establish the foundation for all speakasap services.

---

## Inputs

- `docs/refactoring/ROADMAP.md` - Port assignments (42xx range) and service structure
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md` - Infrastructure requirements
- `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md` - Phase 1 task breakdown
- Marathon service as reference: `/Users/sergiystashok/Documents/GitHub/marathon`
- nginx-microservice documentation
- Shared microservice documentation (auth, database, logging, notifications)

## Scope

- Create `/Users/sergiystashok/Documents/GitHub/speakasap` directory structure
- Set up base Docker Compose templates for blue/green deployment
- Configure nginx-microservice integration patterns
- Create shared service connection utilities
- Document port allocation (42xx range)
- Create `.env.example` templates
- Set up centralized logging integration
- Create deployment scripts following marathon pattern

## Do

- Create project directory structure:

  ```text
  speakasap/
  ├── README.md
  ├── docker-compose.yml
  ├── .env.example
  ├── scripts/
  │   └── deploy.sh
  └── docs/
      └── infrastructure/
          ├── SHARED_SERVICES.md
          └── PORT_ALLOCATION.md
  ```

- Create Docker Compose base template with:
  - Multi-stage build pattern (like marathon)
  - Blue/green deployment support
  - Health checks
  - Environment variable injection
- Set up nginx-microservice integration:
  - Create nginx route configuration template
  - Document blue/green deployment process
  - Create deployment script template
- Document shared service connection patterns (no shared code package):
  - Logging service integration patterns
  - Database connection patterns
  - Auth service integration patterns
  - Notifications service integration
- Document port allocation:
  - Port 4201: Content Service
  - Port 4202: Certification Service
  - Port 4203: Assessment Service
  - Port 4205: Course Service
  - Port 4206: Education Service
  - Port 4207: User Service
  - Port 4208: Payment Service
  - Port 4209: Notification Service
  - Port 4210: API Gateway
  - Port 4211: Frontend
  - Port 4212: Salary Service
  - Port 4213: Financial Service
- Create `.env.example` template with:
  - Service name
  - Port configuration
  - Database connection (from database-server)
  - Logging service URL
  - Auth service URL (if needed)
  - Other shared service URLs
- Define `.env` + `.env.example` sync steps for local + prod
- Create deployment script template:
  - Follow marathon deployment pattern
  - Integrate with nginx-microservice
  - Support blue/green deployment
  - Handle rollback on failure
- Use env-driven configuration only (no hardcoded values)
- Follow marathon service patterns for consistency

## Do Not

- Do not create service-specific code (only infrastructure)
- Do not hardcode ports or URLs
- Do not create dev environment configs
- Do not modify shared microservices
- Do not create automated tests
- Do not create service implementations (that's TASK-13)
- Do not create database schemas (that's service-specific)

## Outputs

### Required Files

1. **`speakasap/README.md`**
   - Project overview
   - Directory structure
   - How to use base templates
   - Port allocation reference

2. **`speakasap/docker-compose.yml`**
   - Base Docker Compose template
   - Blue/green deployment structure
   - Health check configuration
   - Environment variable placeholders

3. **`speakasap/.env.example`**
   - Base environment variables template
   - All shared service URLs
   - Port configuration
   - Database connection
   - Logging configuration

4. **`speakasap/scripts/deploy.sh`**
   - Deployment script template
   - nginx-microservice integration
   - Blue/green deployment logic
   - Service name auto-detection from .env or directory
   - Rollback handling

5. **`speakasap/docs/infrastructure/SHARED_SERVICES.md`**
   - Shared service connection guide
   - Service URLs and ports
   - Integration patterns
   - Connection examples

6. **`speakasap/docs/infrastructure/PORT_ALLOCATION.md`**
   - Complete port allocation table
   - Service-to-port mapping
   - Port range documentation (42xx)

### Optional Files

- `speakasap/docs/infrastructure/DEPLOYMENT_GUIDE.md` - Deployment process guide
- `speakasap/scripts/health-check.sh` - Health check script template

## Exit Criteria

- ✅ Project structure created
- ✅ Docker templates ready and tested
- ✅ Shared service connections documented
- ✅ Port allocation documented
- ✅ Deployment scripts ready
- ✅ `.env.example` template complete
- ✅ `.env` sync guidance documented (local + prod)
- ✅ All templates follow marathon service patterns
- ✅ Documentation complete

## Verification

1. **Test Docker Template:**

   ```bash
   cd speakasap
   docker compose -f docker-compose.yml config
   # Should validate without errors
   ```

2. **Verify Port Allocation:**
   - Check `PORT_ALLOCATION.md` has all services
   - Verify no port conflicts
   - Confirm 42xx range usage

3. **Test Deployment Script:**
   - Script should validate docker-compose files
   - Should integrate with nginx-microservice
   - Should handle errors gracefully

## Related

- Phase 1 task: `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md` (TASK-11)
- Marathon reference: `/Users/sergiystashok/Documents/GitHub/marathon`
- nginx-microservice: Integration patterns
- Tasks index: `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md`
