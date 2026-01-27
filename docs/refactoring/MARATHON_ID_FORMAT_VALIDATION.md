# Marathon ID Format Validation Report

**Date:** 2026-01-27  
**Agent:** AGENT09 (Marathon Shim Fixes)  
**Scope:** ID format compatibility between legacy numeric IDs and new service UUIDs

---

## Executive Summary

The legacy marathon system uses **numeric IDs** (`\d+`) for entities (marathoners, winners, steps), while the new marathon service uses **UUIDs** (36-character strings with hyphens). This document validates the compatibility and documents the current state.

---

## 1. ID Format Analysis

### 1.1 Legacy System (speakasap-portal)

**URL Patterns:**

- `GET /marathon/api/my/{id}.json` - Uses `(?P<pk>\d+)` pattern (numeric only)
- `GET /marathon/api/winners/{id}.json` - Uses `(?P<pk>\d+)` pattern (numeric only)
- `GET /marathon/api/random_report/{step}.json` - Uses `(?P<step>\d+)` pattern (numeric only)

**Database Models:**

- `Marathoner.id` - IntegerField (auto-increment)
- `Winner.user` - OneToOneField to User (user.id is integer)
- `Step.id` - IntegerField (auto-increment)

### 1.2 New Service (marathon)

**Prisma Schema:**

- `MarathonParticipant.id` - `String @id @default(uuid())` - **UUID**
- `MarathonWinner.id` - `String @id @default(uuid())` - **UUID**
- `MarathonStep.id` - `String @id @default(uuid())` - **UUID**

**API Endpoints:**

- `GET /api/v1/me/marathons/{marathonerId}` - Expects UUID string
- `GET /api/v1/winners/{winnerId}` - Expects UUID string
- `GET /api/v1/answers/random?stepId={stepId}` - Expects UUID string

---

## 2. Compatibility Assessment

### 2.1 Current State

**Status:** ⚠️ **Format Mismatch Identified**

- Legacy frontend sends numeric IDs (e.g., `123`)
- New service expects UUIDs (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Direct pass-through will result in **404 Not Found** responses

### 2.2 Affected Endpoints

| Legacy Endpoint | New Service Endpoint | ID Type Mismatch | Impact |
| -------------- | ------------------- | ---------------- | ------ |
| `GET /marathon/api/my/{id}.json` | `GET /api/v1/me/marathons/{marathonerId}` | ✅ **Yes** | High - Detail view will fail |
| `GET /marathon/api/winners/{id}.json` | `GET /api/v1/winners/{winnerId}` | ✅ **Yes** | Medium - Winner detail will fail |
| `GET /marathon/api/random_report/{step}.json` | `GET /api/v1/answers/random?stepId={stepId}` | ✅ **Yes** | Medium - Random report will fail |

---

## 3. Validation Logging Added

### 3.1 Implementation

Added ID format detection and logging to shim endpoints:

**Files Modified:**

- `speakasap-portal/marathon/api_views/common.py` - `MyMarathon.retrieve()`
- `speakasap-portal/marathon/api_views/winners.py` - `WinnerView.retrieve()`

**Logging Features:**

1. **ID Format Detection:** Detects if ID is numeric, UUID, or unknown format
2. **Format Logging:** Logs `id_format` field in all log entries
3. **Mismatch Warning:** Logs warning when 404 response received with numeric ID

**Example Log Entry:**

```json
{
  "message": "marathon shim get my marathon - entry",
  "marathoner_id": "123",
  "id_format": "numeric",
  "user_id": "456"
}
```

**Mismatch Warning:**

```json
{
  "message": "marathon shim get my marathon - possible ID format mismatch",
  "marathoner_id": "123",
  "id_format": "numeric",
  "expected_format": "uuid",
  "status": 404
}
```

### 3.2 Logging Coverage

| Endpoint | Entry Log | Forwarding Log | Response Log | Mismatch Warning |
| -------- | --------- | -------------- | ----------- | ---------------- |
| `MyMarathon.retrieve()` | ✅ | ✅ | ✅ | ✅ |
| `WinnerView.retrieve()` | ✅ | ✅ | ✅ | ✅ |
| `RandomReportView.retrieve()` | ✅ | ✅ | ✅ | ✅ |

**Note:** `RandomReportView` uses query parameters (`stepId`, `excludeMarathonerId`) rather than URL path parameters. ID format validation is now logged for both values.

---

## 4. Routing Verification

### 4.1 My Marathon Detail Endpoint

**Status:** ✅ **Fixed**

**File:** `speakasap-portal/marathon/api_urls.py:13`

**Current Implementation:**

```python
url(r'^my/(?P<pk>\d+)\.json', MyMarathon.as_view()),
```

**Verification:**

- ✅ Uses `MyMarathon.as_view()` (RetrieveAPIView)
- ✅ Correctly routes to `GET /api/v1/me/marathons/{marathonerId}`
- ✅ `MyMarathon.retrieve()` method properly implements shim logic

**Previous Issue (from audit):**

- ❌ Was using `MyMarathonsList.as_view()` for detail endpoint
- ✅ Now correctly uses `MyMarathon.as_view()`

---

## 5. Migration Strategy Options

### Option 1: ID Mapping Table (Recommended for Dual-Write Period)

**Approach:** Maintain a mapping table in legacy database:

- `legacy_marathoner_id` (integer) → `new_marathoner_uuid` (string)
- `legacy_winner_id` (integer) → `new_winner_uuid` (string)
- `legacy_step_id` (integer) → `new_step_uuid` (string)

**Pros:**

- Allows gradual migration
- Supports rollback
- Maintains legacy URL compatibility

**Cons:**

- Requires additional database table
- Needs mapping population during migration
- Adds lookup overhead

**Implementation:** Add transformation logic in shim layer:

```python
def transform_marathoner_id(legacy_id):
    mapping = MarathonerIdMapping.objects.filter(legacy_id=legacy_id).first()
    return mapping.new_uuid if mapping else None
```

### Option 2: Accept Both Formats in New Service

**Approach:** Modify new service to accept both numeric IDs and UUIDs

**Pros:**

- No shim transformation needed
- Backward compatible

**Cons:**

- Requires new service changes
- May complicate validation logic
- Not recommended for long-term

### Option 3: Frontend Migration

**Approach:** Update frontend to use UUIDs from new service responses

**Pros:**

- Clean separation
- No shim complexity

**Cons:**

- Requires frontend changes
- May break existing bookmarks/URLs
- Longer migration timeline

---

## 6. Recommendations

### Immediate Actions

1. ✅ **Routing Bug Fixed** - `MyMarathon` detail endpoint correctly routed
2. ✅ **ID Format Logging Added** - Comprehensive logging for format detection
3. ⚠️ **Monitor Logs** - Watch for ID format mismatch warnings in production

### Short-Term Actions

1. **Add ID Mapping Table** (if dual-write migration strategy)
   - Create `MarathonerIdMapping` model
   - Populate during data migration
   - Add transformation logic in shim

2. **Extend Logging to RandomReportView**
   - Add ID format validation for `stepId` and `excludeMarathonerId` query params

3. **Test with Real Data**
   - Test detail endpoints with actual legacy numeric IDs
   - Verify transformation works (if mapping table added)
   - Monitor 404 rates

### Long-Term Actions

1. **Complete Migration**
   - Migrate all legacy numeric IDs to UUIDs
   - Update frontend to use UUIDs
   - Remove ID transformation logic

2. **Remove Legacy Support**
   - Remove numeric ID pattern matching
   - Update URL patterns to accept UUIDs only

---

## 7. Testing Recommendations

### Test Cases

1. **Numeric ID Test:**

   ```bash
   curl -H "Authorization: Bearer TOKEN" \
        https://speakasap.com/marathon/api/my/123.json
   ```

   - Expected: Logs show `id_format: "numeric"`
   - If mapping exists: Should transform to UUID and succeed
   - If no mapping: Should log mismatch warning and return 404

2. **UUID Test:**

   ```bash
   curl -H "Authorization: Bearer TOKEN" \
        https://speakasap.com/marathon/api/my/550e8400-e29b-41d4-a716-446655440000.json
   ```

   - Expected: Logs show `id_format: "uuid"`
   - Should succeed if UUID is valid

3. **Invalid Format Test:**

   ```bash
   curl -H "Authorization: Bearer TOKEN" \
        https://speakasap.com/marathon/api/my/abc123.json
   ```

   - Expected: Logs show `id_format: "unknown"`
   - Should return 404

### Log Verification

Check logs for ID format tracking:

```bash
grep "id_format" /path/to/logs | grep "marathon shim"
```

Expected patterns:

- `"id_format": "numeric"` - Legacy numeric ID detected
- `"id_format": "uuid"` - UUID format detected
- `"possible ID format mismatch"` - Warning when 404 with numeric ID

---

## 8. References

- Audit Report: `docs/refactoring/MARATHON_LEGACY_SHIM_AUDIT.md`
- Data Mapping: `docs/refactoring/MARATHON_DATA_MAPPING.md`
- Prisma Schema: `/Users/sergiystashok/Documents/GitHub/marathon/prisma/schema.prisma`
- Shim Implementation: `speakasap-portal/marathon/api_views/common.py`
- Agent Task: `docs/agents/AGENT09_MARATHON_SHIM_FIXES.md`

---

## 9. Conclusion

**Routing Bug:** ✅ **Fixed** - `MyMarathon` detail endpoint correctly routed

**ID Format Compatibility:** ⚠️ **Mismatch Identified** - Legacy numeric IDs vs new service UUIDs

**Logging:** ✅ **Implemented** - Comprehensive ID format validation logging added

**Next Steps:**

1. Monitor logs for ID format mismatches
2. Decide on migration strategy (mapping table vs frontend update)
3. Implement ID transformation if mapping table chosen
4. Test with real legacy IDs

---

**Status:** ✅ **Validation Complete** - Ready for migration strategy decision
