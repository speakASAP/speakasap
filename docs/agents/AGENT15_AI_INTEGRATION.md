# AGENT15: AI Microservice Integration

## Role

Integration Adapter Agent responsible for integrating Content Service with ai-microservice for translation and content generation features.

## Objective

Integrate Content Service with ai-microservice to provide translation capabilities and content generation features, following integration patterns and handling errors gracefully.

---

## Inputs

- `docs/refactoring/CONTENT_AI_INTEGRATION.md` - Integration plan (from TASK-12)
- ai-microservice API documentation
- Content service implementation: `speakasap/content-service/` (from TASK-13)
- Marathon service as reference (for integration patterns)
- Shared service utilities: `speakasap/docs/infrastructure/SHARED_SERVICES.md` (from TASK-11)

## Scope

- Design integration points with ai-microservice
- Implement ai-microservice client service
- Add translation endpoints to Content Service
- Add content generation endpoints (if needed)
- Handle errors and fallbacks
- Add extensive logging for AI calls
- Document integration patterns

## Do

- **Create AI Service Client:**
  - Create `speakasap/content-service/src/shared/ai-client.service.ts`
  - Implement HTTP client for ai-microservice
  - Handle authentication (if needed)
  - Implement retry logic (if needed)
  - Add timeout handling
  - Add extensive logging

- **Implement Translation Endpoints:**
  - Add translation endpoints to appropriate controllers
  - Example: `POST /api/v1/dictionary/translate`
  - Example: `POST /api/v1/grammar/translate`
  - Accept source text and target language
  - Call ai-microservice for translation
  - Return translated content
  - Handle errors gracefully

- **Implement Content Generation (if needed):**
  - Add content generation endpoints (if specified in integration plan)
  - Call ai-microservice for content generation
  - Return generated content
  - Handle errors gracefully

- **Error Handling:**
  - Handle ai-microservice unavailability
  - Handle timeout errors
  - Handle rate limiting (if applicable)
  - Return appropriate error responses
  - Log all errors with context

- **Logging:**
  - Log all AI service calls
  - Log request details (text, language, etc.)
  - Log response details (translation, latency)
  - Log errors with full context
  - Follow marathon service logging patterns

- **Configuration:**
  - Add `AI_SERVICE_URL` to `.env.example`
  - Add `AI_SERVICE_TIMEOUT` (if needed)
  - Add `AI_SERVICE_API_KEY` (if needed)
  - Use env-driven configuration only

- **Documentation:**
  - Document integration endpoints
  - Document error handling
  - Document fallback behavior
  - Update API contract if needed

## Do Not

- Do not modify ai-microservice
- Do not hardcode AI service URLs
- Do not create automated tests
- Do not modify core content service logic unnecessarily
- Do not skip error handling
- Do not skip logging

## Outputs

### Required Files

1. **`speakasap/content-service/src/shared/ai-client.service.ts`**
   - AI microservice client implementation
   - HTTP client with retry logic
   - Error handling
   - Logging integration
   - Timeout handling

2. **Updated Controllers:**
   - Translation endpoints added to appropriate controllers
   - Content generation endpoints (if needed)
   - Error handling
   - Logging

3. **Updated `.env.example`:**
   - `AI_SERVICE_URL` added
   - `AI_SERVICE_TIMEOUT` added (if needed)
   - `AI_SERVICE_API_KEY` added (if needed)

4. **`docs/refactoring/CONTENT_AI_INTEGRATION_IMPLEMENTATION.md`**
   - Implementation details
   - Endpoint documentation
   - Error handling documentation
   - Usage examples

### Optional Files

- `speakasap/content-service/src/ai/` - Separate AI module (if complex)

## Exit Criteria

- ✅ AI integration implemented
- ✅ Translation endpoints working
- ✅ Error handling in place
- ✅ Logging integrated
- ✅ Configuration documented
- ✅ Integration tested
- ✅ Documentation complete

## Verification Steps

1. **Test Translation:**

   ```bash
   curl -X POST http://localhost:4201/api/v1/dictionary/translate \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello", "targetLanguage": "ru"}'
   # Should return translation
   ```

2. **Test Error Handling:**
   - Disconnect ai-microservice
   - Make translation request
   - Should handle error gracefully
   - Should log error appropriately

3. **Check Logging:**

   ```bash
   docker compose logs content-service | grep "ai"
   # Should show AI service calls with details
   ```

## Integration Patterns

### Translation Pattern

1. Receive translation request
2. Validate input (text, target language)
3. Log request
4. Call ai-microservice
5. Log response (success/error)
6. Return translated content or error

### Error Handling Pattern

- **Service Unavailable:** Return 503 with appropriate message
- **Timeout:** Return 504 with timeout message
- **Invalid Input:** Return 400 with validation error
- **Rate Limit:** Return 429 with retry-after header
- **All Errors:** Log with full context

## Related

- Design task: `docs/agents/AGENT12_CONTENT_DESIGN.md` (TASK-12)
- Implementation task: `docs/agents/AGENT13_CONTENT_IMPLEMENTATION.md` (TASK-13)
- Phase 1 task: `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md` (TASK-15)
- Integration plan: `docs/refactoring/CONTENT_AI_INTEGRATION.md`
- Tasks index: `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md`
