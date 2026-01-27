# Phase 1 Task Decomposition

**Date:** 2026-01-26  
**Status:** 📋 Planning  
**Phase:** Foundation & Infrastructure - Content Service  
**Lead Orchestrator:** Task Decomposition Complete

---

## Phase 1 Overview

**Goal:** Set up infrastructure and extract low-risk Content Service (read-only)

**Scope:**

- Project setup and infrastructure foundation
- Content Service extraction (grammar, phonetics, dictionary, songs, language)
- Integration with ai-microservice for translations
- Notifications-microservice integration (shared service wiring and env keys)

**Port:** 4201  
**Database:** `speakasap_content_db`

**Deliverables:**

- ✅ Content service running
- ✅ Infrastructure ready for next phases

---

## Global Dependency Graph

```text
Phase 0 (Marathon) → Phase 1 (Foundation & Content)
Phase 1 → Phase 2 (Certification, Assessment)
Phase 2 → Phase 3 (Course, Education, User)
Phase 3 → Phase 4 (Payment, Notification, Salary, Financial)
Phase 4 → Phase 5 (Frontend, API Gateway)
Phase 5 → Phase 6 (Integration)
Phase 6 → Phase 7 (Migration & Decommissioning)
```

---

## Phase 1 Task Groups

### Group A: Infrastructure Setup (Sequential)

**Can be executed in parallel?** NO - Must be sequential  
**Dependencies:** Phase 0 completion  
**Outputs:** Project structure, Docker configs, shared service connections  
**Agents Count:** 1 (Infra/Docker Agent)

**Tasks:**

- TASK-11: Project Setup and Infrastructure Foundation

---

### Group B: Content Service (Parallel after Group A)

**Can be executed in parallel?** YES - Can run in parallel after TASK-11  
**Dependencies:** TASK-11  
**Outputs:** Content service implementation, API endpoints, data migration  
**Agents Count:** 3 (Backend Service Agent, Data Migration Agent, Integration Agent)

**Tasks:**

- TASK-12: Content Service Design and API Contract
- TASK-13: Content Service Implementation
- TASK-14: Content Data Migration
- TASK-15: AI Microservice Integration

---

### Group C: Validation (After Group B)

**Can be executed in parallel?** NO - Must wait for Group B  
**Dependencies:** TASK-11 through TASK-15  
**Outputs:** Validation report, cutover checklist  
**Agents Count:** 1 (QA/Contract Validator Agent)

**Tasks:**

- TASK-16: Phase 1 Validation and Cutover Checklist

---

## Individual Agent Tasks

### TASK-11: Project Setup and Infrastructure Foundation

**Agent Type:** Infra/Docker Agent  
**Dependencies:** Phase 0 completion  
**Parallel Execution:** NO (foundation task)

#### Objective

Set up the `speakasap` project structure, Docker configuration, and shared microservice connections to establish the foundation for all Phase 1+ services.

#### Scope

- Create `speakasap` directory structure
- Set up Docker Compose files (blue/green deployment)
- Configure nginx-microservice integration
- Set up shared microservice connections (auth, database, logging)
- Create `.env.example` files
- Configure port allocation (42xx range)
- Set up logging integration

#### Inputs

- `docs/refactoring/ROADMAP.md` - Port assignments and service structure
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md` - Infrastructure requirements
- Marathon service as reference (`/Users/sergiystashok/Documents/GitHub/marathon`)
- nginx-microservice documentation
- Shared microservice documentation

#### Do

- Create `/Users/sergiystashok/Documents/GitHub/speakasap` directory structure
- Create base Docker Compose templates for blue/green deployment
- Set up nginx-microservice integration patterns
- Document shared service connection patterns (no shared code package)
- Add notifications-microservice integration patterns and env keys
- Document port allocation (42xx range)
- Create `.env.example` templates
- Define `.env` + `.env.example` sync steps for local + prod
- Set up centralized logging integration
- Create deployment scripts following marathon pattern

#### Do Not

- Do not create service-specific code (only infrastructure)
- Do not hardcode ports or URLs
- Do not create dev environment configs
- Do not modify shared microservices
- Do not create automated tests

#### Outputs

- `speakasap/README.md` - Project structure documentation
- `speakasap/docker-compose.yml` - Base Docker Compose template
- `speakasap/.env.example` - Base environment variables template
- `speakasap/scripts/deploy.sh` - Deployment script template
- `speakasap/docs/infrastructure/SHARED_SERVICES.md` - Shared service connection guide
- `speakasap/docs/infrastructure/PORT_ALLOCATION.md` - Port allocation documentation

#### Exit Criteria

- ✅ Project structure created
- ✅ Docker templates ready
- ✅ Shared service connections documented
- ✅ Port allocation documented
- ✅ Deployment scripts ready
- ✅ `.env` sync guidance documented (local + prod)

---

### TASK-12: Content Service Design and API Contract

**Agent Type:** Backend Service Agent (Design Phase)  
**Dependencies:** TASK-11  
**Parallel Execution:** YES (with TASK-13 after contract is defined)

#### Objective

Design the Content Service API contract and data model based on legacy content apps (grammar, phonetics, dictionary, songs, language).

#### Scope

- Analyze legacy content models
- Define API endpoints (read-only)
- Design data model (Prisma schema)
- Document API contract
- Define integration points with ai-microservice

#### Inputs

- Legacy repo: `/Users/sergiystashok/Documents/GitHub/speakasap-portal`
- Legacy apps: `grammar`, `phonetics`, `dictionary`, `songs`, `language`
- `docs/refactoring/ROADMAP.md` - Content service requirements
- ai-microservice documentation

#### Do

- Analyze legacy content models
- Define REST API endpoints (GET only)
- Design Prisma schema for content data
- Document API contract with request/response shapes
- Define pagination (max 30 items)
- Document ai-microservice integration points
- Create data mapping document
- Include legacy URL mapping for each new endpoint

#### Do Not

- Do not implement service code (TASK-13)
- Do not create database migrations yet
- Do not modify legacy code
- Do not invent new domain terms

#### Outputs

- `docs/refactoring/CONTENT_API_CONTRACT.md` - API contract documentation
- `docs/refactoring/CONTENT_DATA_MAPPING.md` - Data mapping from legacy to new schema
- `speakasap/content-service/prisma/schema.prisma` - Prisma schema (draft)
- `docs/refactoring/CONTENT_AI_INTEGRATION.md` - AI microservice integration plan

#### Exit Criteria

- ✅ API contract documented
- ✅ Data model designed
- ✅ Integration points defined
- ✅ Contract approved by Lead Orchestrator

---

### TASK-13: Content Service Implementation

**Agent Type:** Backend Service Agent (Implementation Phase)  
**Dependencies:** TASK-11, TASK-12  
**Parallel Execution:** YES (with TASK-14 after implementation)

#### Objective

Implement the Content Service as a NestJS application with all API endpoints, business logic, and database integration.

#### Scope

- Create NestJS application structure
- Implement all API endpoints (GET only)
- Implement business logic
- Set up Prisma integration
- Integrate with logging service
- Set up auth guard (if needed for some endpoints)
- Create health endpoint

#### Inputs

- `docs/refactoring/CONTENT_API_CONTRACT.md` - API contract
- `speakasap/content-service/prisma/schema.prisma` - Prisma schema
- Marathon service as reference implementation
- Shared service connection documentation from TASK-11

#### Do

- Create NestJS application structure
- Implement controllers for all endpoints
- Implement services with business logic
- Set up Prisma service
- Integrate centralized logging
- Create health endpoint
- Add extensive logging (following marathon pattern)
- Set up error handling
- Create Dockerfile and docker-compose files

#### Do Not

- Do not create write endpoints (read-only service)
- Do not modify shared microservices
- Do not hardcode configuration
- Do not create automated tests
- Do not create dev environment

#### Outputs

- `speakasap/content-service/src/` - Complete NestJS application
- `speakasap/content-service/Dockerfile` - Docker configuration
- `speakasap/content-service/docker-compose.blue.yml` - Blue deployment config
- `speakasap/content-service/docker-compose.green.yml` - Green deployment config
- `speakasap/content-service/.env.example` - Environment variables template
- `speakasap/content-service/scripts/deploy.sh` - Deployment script
- `speakasap/content-service/README.md` - Service documentation

#### Execution Status

**Status:** ✅ Complete

**Progress:**
- ✅ NestJS application structure created
- ✅ Controllers/services for read-only endpoints
- ✅ Prisma integration and logging
- ✅ Docker configs and deploy script (moved to root level)
- ✅ `.env.example` and README created
- ✅ Build/run verification complete
- ✅ Prisma migrations created and applied
- ✅ Service deployed and running
- ✅ `.env.example` includes NOTIFICATIONS_MICROSERVICE_URL

#### Exit Criteria

- All API endpoints implemented
- Service compiles and runs
- Health endpoint works
- Logging integrated
- Docker configuration ready

---

### TASK-14: Content Data Migration

**Agent Type:** Data Migration Agent  
**Dependencies:** TASK-12, TASK-13  
**Parallel Execution:** YES (with TASK-15)

#### Objective

Migrate content data from legacy Django models to new Prisma schema.

#### Scope

- Create Prisma migrations
- Write data migration scripts
- Migrate grammar data
- Migrate phonetics data
- Migrate dictionary data
- Migrate songs data
- Migrate language data
- Validate data integrity

#### Inputs

- Legacy database (speakasap-portal)
- `docs/refactoring/CONTENT_DATA_MAPPING.md` - Data mapping
- `speakasap/content-service/prisma/schema.prisma` - Target schema

#### Do

- Create Prisma migrations
- Write Python/Django script to extract legacy data
- Transform data according to mapping document
- Load data into new database
- Validate data integrity
- Document migration process
- Create rollback script (if needed)

#### Do Not

- Do not modify legacy database
- Do not delete legacy data
- Do not create automated tests
- Do not modify service code (TASK-13)

#### Outputs

- `speakasap/content-service/prisma/migrations/` - Prisma migrations
- `speakasap/content-service/scripts/migrate-content-data.py` - Data migration script
- `docs/refactoring/CONTENT_DATA_MIGRATION_LOG.md` - Migration execution log
- `docs/refactoring/CONTENT_DATA_VALIDATION.md` - Data validation report

#### Exit Criteria

- All content data migrated
- Data integrity validated
- Migration process documented
- Rollback plan documented

---

### TASK-15: AI Microservice Integration

**Agent Type:** Integration Adapter Agent  
**Dependencies:** TASK-12, TASK-13  
**Parallel Execution:** YES (with TASK-14)

#### Objective

Integrate Content Service with ai-microservice for translation and content generation features.

#### Scope

- Design integration points
- Implement ai-microservice client
- Add translation endpoints
- Add content generation endpoints (if needed)
- Handle errors and fallbacks
- Add logging for AI calls

#### Inputs

- `docs/refactoring/CONTENT_AI_INTEGRATION.md` - Integration plan
- ai-microservice API documentation
- Content service implementation (TASK-13)

#### Do

- Create ai-microservice client service
- Implement translation endpoints
- Add error handling
- Add retry logic (if needed)
- Integrate logging
- Document integration patterns

#### Do Not

- Do not modify ai-microservice
- Do not hardcode AI service URLs
- Do not create automated tests
- Do not modify core content service logic unnecessarily

#### Outputs

- `speakasap/content-service/src/shared/ai-client.service.ts` - AI service client
- `speakasap/content-service/src/ai/` - AI integration endpoints (if separate module)
- `docs/refactoring/CONTENT_AI_INTEGRATION_IMPLEMENTATION.md` - Implementation details

#### Exit Criteria

- AI integration implemented
- Translation endpoints working
- Error handling in place
- Logging integrated

---

### TASK-16: Phase 1 Validation and Cutover Checklist

**Agent Type:** QA/Contract Validator Agent  
**Dependencies:** TASK-11 through TASK-15  
**Parallel Execution:** NO (final validation)

#### Objective

Validate Phase 1 deliverables and create cutover checklist for Content Service.

#### Scope

- Validate API contract implementation
- Validate data migration
- Validate AI integration
- Test all endpoints
- Create cutover checklist
- Document validation results

#### Inputs

- All Phase 1 deliverables
- `docs/refactoring/CONTENT_API_CONTRACT.md` - API contract
- `docs/refactoring/CONTENT_DATA_MAPPING.md` - Data mapping
- Legacy content endpoints for comparison

#### Do

- Review API contract implementation
- Validate data migration completeness
- Test all endpoints
- Validate AI integration
- Create validation report
- Create cutover checklist
- Document any gaps or issues

#### Do Not

- Do not modify service code
- Do not modify data migration
- Do not skip validation steps

#### Outputs

- `docs/refactoring/PHASE1_VALIDATION_REPORT.md` - Validation report
- `docs/refactoring/CONTENT_CUTOVER_CHECKLIST.md` - Cutover checklist
- `docs/refactoring/PHASE1_COMPLETION_SUMMARY.md` - Phase 1 completion summary

#### Exit Criteria

- All validation criteria met
- Cutover checklist approved
- GO/NO-GO decision made
- Ready for cutover or fixes identified

---

## Phase 1 Sync Points

### Sync A: Infrastructure Foundation Ready

**When:** After TASK-11 completion  
**Validation:** Project structure created, Docker templates ready, shared services connected  
**Gate:** Must pass before TASK-12/TASK-13 can proceed

### Sync B: API Contract Frozen

**When:** After TASK-12 completion  
**Validation:** API contract approved, data model designed  
**Gate:** Must pass before TASK-13/TASK-14/TASK-15 can proceed

### Sync C: Implementation Complete

**When:** After TASK-13, TASK-14, TASK-15 completion  
**Validation:** Service implemented, data migrated, AI integrated  
**Gate:** Must pass before TASK-16 can proceed

### Sync D: Phase 1 Validation Complete

**When:** After TASK-16 completion  
**Validation:** All validation criteria met, cutover checklist approved  
**Gate:** Must pass before Phase 1 cutover or Phase 2 planning

---

## Phase 1 Success Criteria

Phase 1 is considered **COMPLETE** when:

1. ✅ Infrastructure foundation established
2. ✅ Content Service API contract defined and approved
3. ✅ Content Service implemented and deployed
4. ✅ Content data migrated successfully
5. ✅ AI microservice integrated
6. ✅ All endpoints tested and working
7. ✅ Validation report shows GO status
8. ✅ Cutover checklist approved
9. ✅ Service stable in production

---

## Agent Prompts Location

Agent prompts will be created in:

- `docs/agents/AGENT11_INFRA_SETUP.md`
- `docs/agents/AGENT12_CONTENT_DESIGN.md`
- `docs/agents/AGENT13_CONTENT_IMPLEMENTATION.md`
- `docs/agents/AGENT14_CONTENT_MIGRATION.md`
- `docs/agents/AGENT15_AI_INTEGRATION.md`
- `docs/agents/AGENT16_PHASE1_VALIDATION.md`

---

## Next Steps

1. **Review and Approve Task Decomposition**
   - Lead Orchestrator reviews this document
   - Adjustments made if needed
   - Task decomposition approved

2. **Create Agent Prompts**
   - Create detailed agent prompts for each task
   - Include DO/DO NOT rules
   - Define exit criteria clearly

3. **Begin Phase 1 Execution**
   - Start with TASK-11 (Infrastructure Setup)
   - Follow sync points
   - Monitor progress

4. **Update Tasks Index**
   - Add Phase 1 tasks to `SPEAKASAP_REFACTORING_TASKS_INDEX.md`
   - Update master prompt with Phase 1 scope

---

**Last Updated:** 2026-01-26  
**Status:** 📋 Ready for Review and Approval
