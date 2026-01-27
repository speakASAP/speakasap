# Marathon Parity Audit Report

**Date:** 2026-01-26  
**Agent:** AGENT07 (Marathon Parity Audit)  
**Scope:** Audit `marathon` repo against `MARATHON_PARITY_CHECKLIST.md`  
**Marathon Repo:** `/Users/sergiystashok/Documents/GitHub/marathon`

---

## Executive Summary

**Status: ❌ NO-GO for Parity**

The marathon service implements all required endpoints with correct business logic, but has **critical response shape mismatches** that prevent direct parity with legacy API responses. The shim layer would need transformation logic to bridge these differences, or the marathon service needs to be updated to match legacy response formats exactly.

---

## 1. Endpoint Existence & Routing

### ✅ Winners Endpoints

| Endpoint | Legacy Route | New Service Route | Status | File Reference |
| -------- | ------------ | ----------------- | ------ | -------------- |
| List | `GET /marathon/api/winners.json` | `GET /api/v1/winners` | ✅ Exists | `src/winners/winners.controller.ts:12` |
| Detail | `GET /marathon/api/winners/{id}.json` | `GET /api/v1/winners/{winnerId}` | ✅ Exists | `src/winners/winners.controller.ts:22` |

### ✅ Random Report Endpoint

| Endpoint | Legacy Route | New Service Route | Status | File Reference |
| -------- | ------------ | ----------------- | ------ | -------------- |
| Random | `GET /marathon/api/random_report/{step}.json?marathoner=` | `GET /api/v1/answers/random?stepId=&excludeMarathonerId=` | ✅ Exists | `src/answers/answers.controller.ts:8` |

### ✅ My Marathons Endpoints

| Endpoint | Legacy Route | New Service Route | Status | File Reference |
| -------- | ------------ | ----------------- | ------ | -------------- |
| List | `GET /marathon/api/my.json` | `GET /api/v1/me/marathons` | ✅ Exists | `src/me/me.controller.ts:13` |
| Detail | `GET /marathon/api/my/{id}.json` | `GET /api/v1/me/marathons/{marathonerId}` | ✅ Exists | `src/me/me.controller.ts:18` |

### ✅ Languages Endpoint

| Endpoint | Legacy Route | New Service Route | Status | File Reference |
| -------- | ------------ | ----------------- | ------ | -------------- |
| List | `GET /marathon/api/languages.json` | `GET /api/v1/marathons/languages` | ✅ Exists | `src/marathons/marathons.controller.ts:17` |

### ✅ Reviews Endpoint

| Endpoint | Legacy Route | New Service Route | Status | File Reference |
| -------- | ------------ | ----------------- | ------ | -------------- |
| List | `GET /marathon/api/reviews.json` | `GET /api/v1/reviews` | ✅ Exists | `src/reviews/reviews.controller.ts:8` |

### ✅ Registration Endpoint

| Endpoint | Legacy Route | New Service Route | Status | File Reference |
| -------- | ------------ | ----------------- | ------ | -------------- |
| Register | `POST /marathon/api/register.json` | `POST /api/v1/registrations` | ✅ Exists | `src/registrations/registrations.controller.ts:8` |

---

## 2. Business Logic Parity

### ✅ Winners List/Detail Logic

**File:** `src/winners/winners.service.ts`

- ✅ **Pagination:** `limit` parameter respected; default = 24, max = 30 (lines 42-43, 64-67)
- ✅ **Ordering:** gold desc, silver desc, bronze desc (lines 51-55)
- ✅ **Filters:** Only winners with medals (gold/silver/bronze > 0) (lines 44-49)
- ✅ **Detail filtering:** Same medal filter applied (lines 118-122)

### ✅ Random Report Logic

**File:** `src/answers/answers.service.ts`

- ✅ **Completed only:** Filters `isCompleted: true` (line 23)
- ✅ **Exclusion:** Excludes `marathoner` if `excludeMarathonerId` provided (lines 26-28)
- ✅ **404 handling:** Returns `null`, controller throws `NotFoundException` (lines 17-19, 46-48)

### ✅ My Marathons Logic

**File:** `src/me/me.service.ts`

- ✅ **User filtering:** Filters by `userId` (lines 39, 66-70)
- ✅ **Response shape:** All required fields present (lines 118-130)

### ✅ Languages Logic

**File:** `src/marathons/marathons.service.ts`

- ✅ **Metadata:** Returns `id`, `code`, `small_icon`, `payment_url`, `name`, `full_name`, `url` (lines 131-139)
- ✅ **Active filter:** Only active marathons (line 113)

### ✅ Reviews Logic

**File:** `src/reviews/reviews.service.ts`

- ✅ **Static list:** Returns hardcoded reviews matching legacy (lines 11-121)

### ✅ Registration Logic

**File:** `src/registrations/registrations.service.ts`

- ✅ **Marathon lookup:** Finds active marathon by `languageCode` (lines 34-40)
- ✅ **Participant creation:** Creates marathoner with correct defaults (lines 49-59)
- ✅ **Response:** Returns `marathonerId` and `redirectUrl` (line 78)

---

## 3. Response Shape Parity

### ❌ Winners List Response Format

**Gap:** Pagination response structure mismatch

**Legacy Format (DRF PageNumberPagination):**

```json
{
  "count": 123,
  "next": "http://api.example.org/winners/?page=4",
  "previous": "http://api.example.org/winners/?page=2",
  "results": [
    {"id": "1", "name": "...", "gold": 5, "silver": 3, "bronze": 1, "avatar": "..."}
  ]
}
```

**New Service Format:**

```json
{
  "items": [
    {"id": "1", "name": "...", "gold": 5, "silver": 3, "bronze": 1, "avatar": "..."}
  ],
  "page": 1,
  "limit": 24,
  "total": 123,
  "nextPage": 2,
  "prevPage": null
}
```

**File:** `src/winners/winners.service.ts:25-32, 98-105`

**Impact:** Frontend expecting DRF format will break. Shim would need transformation logic.

**Recommendation:** Either:

1. Update marathon service to return DRF-compatible format, OR
2. Add transformation in shim layer, OR
3. Update frontend to handle new format

### ✅ Winners Detail Response Shape

**Status:** ✅ Matches `WinnerDetailSerializer`

**Fields:** `id`, `name`, `gold`, `silver`, `bronze`, `reviews[]`  
**File:** `src/winners/winners.service.ts:21-23, 127-135`

### ⚠️ Random Report Response Shape

**Status:** ⚠️ Partial match - field names differ

**Legacy Format (`AnswerSerializer`):**

```json
{
  "marathoner": {"name": "John Doe"},
  "report": "<html>...</html>",
  "complete_time": "2026-01-26T10:00:00Z"
}
```

**New Service Format:**

```json
{
  "marathoner": {"name": "John Doe"},
  "report": "<html>...</html>",
  "complete_time": "2026-01-26T10:00:00Z"
}
```

**File:** `src/answers/answers.service.ts:4-10, 62-68`

**Note:** Field names match, but `report` generation logic may differ. Legacy uses Django template rendering (`render_to_string`), new service uses simple string concatenation (lines 71-80). Content structure may vary.

### ✅ My Marathons Response Shape

**Status:** ✅ Matches `MyMarathonSerializer`

**Fields:** `title`, `type`, `needs_payment`, `registered`, `id`, `bonus_total`, `bonus_left`, `can_change_report_time`, `report_time`, `current_step`, `answers[]`  
**File:** `src/me/me.service.ts:14-26, 118-130`

### ✅ Languages Response Shape

**Status:** ✅ Matches `MarathonLanguageSerializer`

**Fields:** `id`, `code`, `small_icon`, `payment_url`, `name`, `full_name`, `url`  
**File:** `src/marathons/marathons.service.ts:18-26, 131-139`

### ✅ Reviews Response Shape

**Status:** ✅ Matches `ReviewSerializer`

**Fields:** `name`, `photo`, `text`  
**File:** `src/reviews/reviews.service.ts:4-8, 127-129`

---

## 4. Auth / Access Parity

### ✅ My Marathons Auth

**Status:** ✅ Auth required

**Implementation:** `@UseGuards(AuthGuard)` on `MeController`  
**File:** `src/me/me.controller.ts:9`

**Legacy:** `permission_classes = [permissions.IsAuthenticated]`  
**Match:** ✅ Both require authentication

### ✅ Public Endpoints

**Status:** ✅ Public access

**Endpoints:**

- `GET /api/v1/winners` - No guard (public)
- `GET /api/v1/winners/{winnerId}` - No guard (public)
- `GET /api/v1/answers/random` - No guard (public)
- `GET /api/v1/reviews` - No guard (public)
- `GET /api/v1/marathons/languages` - No guard (public)

**Legacy:** `permission_classes = [permissions.AllowAny]` or `IsAuthenticatedOrReadOnly`  
**Match:** ✅ All are publicly accessible

### ⚠️ Registration Auth

**Status:** ⚠️ No explicit anonymous-only guard

**Implementation:** No guard on `RegistrationsController`  
**File:** `src/registrations/registrations.controller.ts:4`

**Legacy:** `@permission_classes([OnlyAnonymous])` - explicitly anonymous only  
**Gap:** New service allows authenticated users to register (may be intentional, but differs from legacy)

**Recommendation:** Add anonymous-only guard if legacy behavior must be preserved.

---

## 5. Request Parameters Parity

### ✅ Winners Pagination

**Legacy:** `limit` query parameter (default 24)  
**New:** `limit` query parameter (default 24, max 30)  
**File:** `src/winners/winners.controller.ts:14-15, 18`

**Status:** ✅ Matches

### ✅ Random Report Parameters

**Legacy:** `step` (path), `marathoner` (query)  
**New:** `stepId` (query), `excludeMarathonerId` (query)  
**File:** `src/answers/answers.controller.ts:10-11`

**Status:** ⚠️ Parameter names differ, but shim handles mapping (see `MARATHON_LEGACY_SHIM_PLAN.md`)

### ✅ Registration Body

**Legacy:** `{ email, phone?, name?, password?, languageCode? }`  
**New:** `{ email, phone?, name?, password?, languageCode? }`  
**File:** `src/registrations/registrations.service.ts:5-11`

**Status:** ✅ Matches

---

## 6. Error Handling

### ✅ 404 Handling

- **Random report:** Returns `NotFoundException` when no match (lines 17-19)
- **Winners detail:** Returns `null` (controller may need explicit 404)
- **My marathon detail:** Returns `null` (controller may need explicit 404)

**Gap:** Controllers returning `null` should throw `NotFoundException` for proper 404 responses.

**Files:**

- `src/winners/winners.controller.ts:25` - Returns `null`, should throw `NotFoundException`
- `src/me/me.controller.ts:22` - Returns `null`, should throw `NotFoundException`

---

## 7. Summary of Gaps

### Critical Gaps (Blocking Parity)

1. **❌ Winners List Pagination Format**
   - Legacy: DRF format `{count, next, previous, results[]}`
   - New: Custom format `{items[], page, limit, total, nextPage, prevPage}`
   - **Impact:** Frontend expecting DRF format will break
   - **File:** `src/winners/winners.service.ts:25-32`

### Medium Gaps (May Cause Issues)

1. **⚠️ Random Report Report Generation**
   - Legacy: Django template rendering with form fields
   - New: Simple string concatenation
   - **Impact:** Report HTML structure may differ
   - **File:** `src/answers/answers.service.ts:71-80`

2. **⚠️ Registration Auth**
   - Legacy: Anonymous only (`OnlyAnonymous` permission)
   - New: No guard (allows authenticated users)
   - **Impact:** Behavior differs from legacy
   - **File:** `src/registrations/registrations.controller.ts:4`

### Minor Gaps (Edge Cases)

1. **⚠️ 404 Error Handling**
   - Controllers return `null` instead of throwing `NotFoundException`
   - **Files:** `src/winners/winners.controller.ts:25`, `src/me/me.controller.ts:22`

---

## 8. GO/NO-GO Recommendation

### ❌ NO-GO for Direct Parity

**Reasoning:**

1. **Critical pagination format mismatch** prevents drop-in replacement without shim transformation
2. **Registration auth behavior** differs from legacy (may be intentional but should be documented)
3. **404 handling** inconsistencies may cause client confusion

**Required Actions Before Parity:**

1. **Option A (Recommended):** Update marathon service to return DRF-compatible pagination format for winners list
2. **Option B:** Add transformation layer in shim to convert new format to legacy format
3. **Option C:** Update frontend to handle new pagination format (if frontend is being updated)

**Additional Recommendations:**

- Add anonymous-only guard to registration endpoint if legacy behavior must be preserved
- Standardize 404 handling: throw `NotFoundException` instead of returning `null`
- Verify random report HTML generation matches legacy output structure
- Consider adding response transformation tests comparing legacy vs new service outputs

---

## 9. Evidence Files

### Implemented Endpoints

- `src/winners/winners.controller.ts` - Winners endpoints
- `src/winners/winners.service.ts` - Winners business logic
- `src/answers/answers.controller.ts` - Random report endpoint
- `src/answers/answers.service.ts` - Random report logic
- `src/me/me.controller.ts` - My marathons endpoints
- `src/me/me.service.ts` - My marathons logic
- `src/marathons/marathons.controller.ts` - Languages endpoint
- `src/marathons/marathons.service.ts` - Languages logic
- `src/reviews/reviews.controller.ts` - Reviews endpoint
- `src/reviews/reviews.service.ts` - Reviews logic
- `src/registrations/registrations.controller.ts` - Registration endpoint
- `src/registrations/registrations.service.ts` - Registration logic

### Configuration

- `src/main.ts:14` - Base path: `/api/v1`
- `src/shared/auth.guard.ts` - Auth guard implementation

---

## 10. Next Steps

1. **Decision:** Choose approach for pagination format (service update vs shim transformation)
2. **Fix:** Address registration auth if legacy behavior required
3. **Fix:** Standardize 404 error handling
4. **Test:** Verify random report HTML output matches legacy
5. **Re-audit:** Re-run audit after fixes

---

## 11. Post-Fix Update (2026-01-26)

### ✅ Fixes Applied

1. **✅ Pagination Format - Option C Selected**
   - **Decision:** Update frontend to handle new format
   - **Files Updated:**
     - `speakasap-portal/marathon/static/marathon/js/winners.js` - Changed `response.results` → `response.items`, `response.next` → `response.nextPage`
     - `speakasap-portal/marathon/static/marathon/js/winners.ts` - Changed `response.results` → `response.items`, `response.next` → `response.nextPage`
   - **Status:** ✅ Frontend updated to handle new pagination format `{items[], page, limit, total, nextPage, prevPage}`

2. **✅ 404 Handling Standardized**
   - **Status:** ✅ Already fixed - All controllers throw `NotFoundException`
   - **Verified:**
     - `winners.controller.ts:27-29` - Throws `NotFoundException`
     - `me.controller.ts:24-26` - Throws `NotFoundException`
     - `answers.controller.ts:17-19` - Already throws `NotFoundException`

### Updated GO/NO-GO Recommendation

### ✅ **GO** - Ready for Cutover (After Frontend Deployment)

**Reasoning:**

1. ✅ **Pagination format:** Frontend updated to handle new format (Option C implemented)
2. ⚠️ **Registration auth:** Behavior differs but may be intentional (documented)
3. ✅ **404 handling:** Standardized across all controllers

**Remaining Actions:**

1. **Deploy frontend** with pagination format updates
2. **Test frontend** with new format
3. **Verify marathon service health**
4. **Enable shim** following cutover runbook

**Reference:** See `MARATHON_CUTOVER_VERIFICATION.md` for verification steps
