# AGENT12: Content Service Design and API Contract

## Role

Backend Service Agent (Design Phase) responsible for designing the Content Service API contract and data model.

## Objective

Design the Content Service API contract and Prisma schema based on legacy content apps (grammar, phonetics, dictionary, songs, language), defining read-only endpoints and integration points with ai-microservice.

---

## Inputs

- Legacy repo: `/Users/sergiystashok/Documents/GitHub/speakasap-portal`
- Legacy apps: `grammar`, `phonetics`, `dictionary`, `songs`, `language`
- `docs/refactoring/ROADMAP.md` - Content service requirements (Phase 1.2)
- `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md` - Task details
- ai-microservice documentation
- Marathon service as reference: `/Users/sergiystashok/Documents/GitHub/marathon` (for patterns)

## Scope

- Analyze legacy content models in Django apps
- Define REST API endpoints (GET only - read-only service)
- Design Prisma schema for content data
- Document API contract with request/response shapes
- Define pagination (max 30 items per request)
- Document ai-microservice integration points
- Create data mapping document

## Do

- **Analyze Legacy Models:**
  - Review `grammar` app models
  - Review `phonetics` app models
  - Review `dictionary` app models
  - Review `songs` app models
  - Review `language` app models
  - Document field types, relationships, constraints

- **Design API Endpoints:**
  - `GET /api/v1/grammar` - List grammar rules (with filters: language, level, etc.)
  - `GET /api/v1/grammar/:id` - Get grammar rule detail
  - `GET /api/v1/phonetics` - List phonetic rules
  - `GET /api/v1/phonetics/:id` - Get phonetic rule detail
  - `GET /api/v1/dictionary` - Search dictionary entries
  - `GET /api/v1/dictionary/:id` - Get dictionary entry detail
  - `GET /api/v1/songs` - List songs (with filters: language, level, etc.)
  - `GET /api/v1/songs/:id` - Get song detail
  - `GET /api/v1/languages` - List available languages
  - `GET /api/v1/languages/:code` - Get language detail
  - `GET /health` - Health check (excluded from prefix)

- **Define Pagination:**
  - Use `page` and `limit` query parameters
  - Max `limit` = 30 items
  - Response format: `{ items[], page, limit, total, nextPage, prevPage }`
  - Follow marathon service pagination pattern

- **Design Prisma Schema:**
  - Create `speakasap/content-service/prisma/schema.prisma`
  - Map legacy models to Prisma models
  - Define relationships
  - Use appropriate field types
  - Add indexes for performance

- **Document API Contract:**
  - Request shapes (query params, path params)
  - Response shapes (success, error)
  - Error codes and messages
  - Filtering and sorting options
  - Pagination details

- **Define AI Integration Points:**
  - Translation endpoints (using ai-microservice)
  - Content generation endpoints (if needed)
  - Integration patterns
  - Error handling for AI calls

- **Create Data Mapping Document:**
  - Map legacy Django models to Prisma models
  - Document field transformations
  - Document relationship mappings
  - Migration strategy

## Do Not

- Do not implement service code (that's TASK-13)
- Do not create database migrations yet (that's TASK-14)
- Do not modify legacy code
- Do not invent new domain terms
- Do not create write endpoints (read-only service)
- Do not create automated tests
- Do not hardcode configuration values

## Outputs

### Required Files

1. **`docs/refactoring/CONTENT_API_CONTRACT.md`**
   - Complete API contract documentation
   - All endpoints with request/response shapes
   - Pagination format
   - Error response format
   - Filtering and sorting options
   - Example requests/responses

2. **`docs/refactoring/CONTENT_DATA_MAPPING.md`**
   - Legacy model analysis
   - Prisma schema design
   - Field mapping (legacy → new)
   - Relationship mappings
   - Migration strategy

3. **`speakasap/content-service/prisma/schema.prisma`** (draft)
   - Prisma schema with all content models
   - Relationships defined
   - Indexes for performance
   - Field types appropriate for content

4. **`docs/refactoring/CONTENT_AI_INTEGRATION.md`**
   - AI microservice integration plan
   - Translation endpoint design
   - Content generation endpoints (if needed)
   - Error handling strategy
   - Fallback behavior

### Optional Files

- `docs/refactoring/CONTENT_FILTERING_OPTIONS.md` - Detailed filtering documentation

## Exit Criteria

- ✅ All legacy models analyzed
- ✅ API contract documented with all endpoints
- ✅ Prisma schema designed and documented
- ✅ Data mapping complete
- ✅ AI integration points defined
- ✅ Contract approved by Lead Orchestrator
- ✅ Ready for TASK-13 (Implementation)

## Verification

1. **API Contract Review:**
   - All endpoints have clear request/response shapes
   - Pagination format matches marathon pattern
   - Error handling documented
   - Filtering options clear

2. **Schema Review:**
   - Prisma schema validates (`npx prisma validate`)
   - All relationships defined
   - Indexes appropriate
   - Field types correct

3. **Data Mapping Review:**
   - All legacy models mapped
   - Field transformations documented
   - Migration strategy clear

## Related

- Phase 1 task: `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md` (TASK-12)
- Implementation task: `docs/agents/AGENT13_CONTENT_IMPLEMENTATION.md` (TASK-13)
- Migration task: `docs/agents/AGENT14_CONTENT_MIGRATION.md` (TASK-14)
- AI integration task: `docs/agents/AGENT15_AI_INTEGRATION.md` (TASK-15)
- Tasks index: `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md`
