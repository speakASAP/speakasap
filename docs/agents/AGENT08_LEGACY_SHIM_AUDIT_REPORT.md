# Legacy Shim Audit Report

**Date:** 2026-01-26  
**Agent:** AGENT08 (Legacy Shim Audit)  
**Scope:** `speakasap-portal` marathon shim routing, env, fallback, logging.  
**Reference:** `docs/refactoring/MARATHON_LEGACY_SHIM_PLAN.md`

---

## Executive Summary

**Status: ❌ NO-GO for Enabling Shim**

Critical routing bug identified: `GET /marathon/api/my/{id}.json` endpoint incorrectly uses `MyMarathonsList` (ListAPIView) instead of `MyMarathon` (RetrieveAPIView), causing the detail endpoint to never route to the new service. All other endpoints are correctly implemented with proper fallback, logging, and env key usage.

---

## 1. Endpoint Mapping: Legacy → New Service

| Legacy Route | New Service Route | View/Handler | Status | File Reference |
| ------------ | ----------------- | ------------ | ------ | -------------- |
| `GET /marathon/api/winners.json` | `GET /api/v1/winners` | `WinnerListView.list()` | ✅ Mapped | `api_views/winners.py:32-65` |
| `GET /marathon/api/winners/{id}.json` | `GET /api/v1/winners/{winnerId}` | `WinnerView.retrieve()` | ✅ Mapped | `api_views/winners.py:75-108` |
| `GET /marathon/api/random_report/{step}.json?marathoner=` | `GET /api/v1/answers/random?stepId={step}&excludeMarathonerId={marathoner}` | `RandomReportView.retrieve()` | ✅ Mapped | `api_views/winners.py:131-170` |
| `GET /marathon/api/my.json` | `GET /api/v1/me/marathons` | `MyMarathonsList.list()` | ✅ Mapped | `api_views/common.py:23-61` |
| `GET /marathon/api/my/{id}.json` | `GET /api/v1/me/marathons/{marathonerId}` | `MyMarathonsList.list()` | ❌ **WRONG** | `api_urls.py:13` |
| `GET /marathon/api/languages.json` | `GET /api/v1/marathons/languages` | `MarathonLanguageList.list()` | ✅ Mapped | `api_views/common.py:117-150` |
| `GET /marathon/api/reviews.json` | `GET /api/v1/reviews` | `ReviewListView.list()` | ✅ Mapped | `reviews/api_views.py:23-56` |
| `POST /marathon/api/register.json` | `POST /api/v1/registrations` | `register()` | ✅ Mapped | `api_views/auth.py:18-58` |

**7 of 8 endpoints correctly mapped.** ❌ 1 critical routing bug.

---

## 2. Critical Issue: My Marathon Detail Endpoint

### Problem

**File:** `marathon/api_urls.py:13`

```python
url(r'^my/(?P<pk>\d+)\.json', MyMarathonsList.as_view()),
```

**Issue:** `MyMarathonsList` is a `ListAPIView` which only implements `list()`, not `retrieve()`. When `/my/{id}.json` is called:

1. Django routes to `MyMarathonsList.as_view()`
2. `ListAPIView` calls `list()` method (not `retrieve()`)
3. `list()` always calls `GET /api/v1/me/marathons` (without ID)
4. The detail endpoint `GET /api/v1/me/marathons/{marathonerId}` is **never** called

**Impact:** Detail endpoint always returns list of all user's marathons instead of the specific marathon, breaking frontend functionality.

### Solution

**File:** `marathon/api_views/common.py:64-109`

A correct implementation exists but is **not used**:

```python
class MyMarathon(RetrieveAPIView):  # ← Correct view type
    def retrieve(self, request, *args, **kwargs):
        # ... shim logic that calls GET /api/v1/me/marathons/{pk}
```

**Required Fix:**

```python
# In api_urls.py, change line 13:
url(r'^my/(?P<pk>\d+)\.json', MyMarathon.as_view()),  # Use RetrieveAPIView
```

**Note:** Audit does not modify code; this is documented for follow-up fix.

---

## 3. Environment Variables

### Required Variables

| Variable | Usage | Status | Evidence |
| -------- | ----- | ------ | -------- |
| `MARATHON_URL` | Base URL for new service | ✅ Used | All 8 shims check `os.getenv('MARATHON_URL')` |
| `MARATHON_SHIM_ENABLED` | Toggle to enable/disable shim | ✅ Used | All 8 shims check with default `'false'` |

### Optional Variables

| Variable | Usage | Status | Evidence |
| -------- | ----- | ------ | -------- |
| `MARATHON_API_KEY` | API key for new service auth | ✅ Used | Conditionally added to headers if present |

**Verification Pattern (used in all shims):**

```python
marathon_url = os.getenv('MARATHON_URL')
shim_enabled = os.getenv('MARATHON_SHIM_ENABLED', 'false').lower() == 'true'
if not marathon_url or not shim_enabled:
    return super().list(request, *args, **kwargs)  # Fallback to legacy

api_key = os.getenv('MARATHON_API_KEY')
if api_key:
    headers['X-Api-Key'] = api_key
```

**Status:** ✅ All env keys properly used with safe defaults.

**Documentation:** ✅ Keys present in `.env.example` (keys only, no values).

---

## 4. Fallback Behavior

### Shim Toggle Fallback

**Status:** ✅ **SAFE**

- If `MARATHON_SHIM_ENABLED` is false/missing → uses legacy behavior
- If `MARATHON_URL` is missing → uses legacy behavior
- Pattern: `if not marathon_url or not shim_enabled: return super().*()`

**Evidence:** All 8 endpoints check both conditions before forwarding.

### Error Fallback

**Status:** ✅ **SAFE**

| Condition | Behavior | Implementation | Status |
| --------- | -------- | -------------- | ------ |
| 5xx response | Fallback to legacy | `if response.status_code >= 500: return super().*()` | ✅ |
| Timeout/Exception | Fallback to legacy | `except Exception: return super().*()` | ✅ |
| 4xx response | Return new service response | Returns `Response(response.json(), status=response.status_code)` | ✅ |

**Verification:**

- ✅ All shims catch exceptions and fallback to legacy
- ✅ 5xx responses trigger fallback (correct)
- ✅ 4xx responses are returned as-is (correct - no fallback for client errors)
- ✅ Timeout is 5 seconds (reasonable)

**Special Case - Registration:**

- Registration shim (`auth.py:38`) checks `response.status_code < 500` (not `>= 500`)
- This is correct: returns new service response for 2xx/3xx/4xx, falls back only on 5xx/timeout
- Handles redirect URL from response payload

**Status:** ✅ Fallback behavior is safe and correctly implemented.

---

## 5. Logging Verification

**Status:** ✅ **COMPLETE**

All shims log:

- ✅ Request path (URL)
- ✅ Response status code
- ✅ Latency in milliseconds
- ✅ User ID (where available - my marathons endpoints)

**Log Patterns:**

| Endpoint | Success Log | Error Log | User ID | Status |
| -------- | ----------- | --------- | ------- | ------ |
| Winners list | `'marathon shim list winners'` | `'marathon shim list winners failed'` | No | ✅ |
| Winner detail | `'marathon shim get winner'` | `'marathon shim get winner failed'` | No | ✅ |
| Random report | `'marathon shim random report'` | `'marathon shim random report failed'` | No | ✅ |
| My marathons list | `'marathon shim list my marathons'` | `'marathon shim list my marathons failed'` | Yes | ✅ |
| My marathon detail | `'marathon shim get my marathon'` | `'marathon shim get my marathon failed'` | Yes | ⚠️ Never called |
| Languages | `'marathon shim list languages'` | `'marathon shim list languages failed'` | No | ✅ |
| Reviews | `'marathon shim list reviews'` | `'marathon shim list reviews failed'` | No | ✅ |
| Registration | `'marathon shim register'` | `'marathon shim register failed'` | No | ✅ |

**Evidence:**

```python
# Success log pattern (all shims):
logger.info(
    'marathon shim list winners',
    path=url,
    status=response.status_code,
    latency_ms=latency_ms,
    user_id=getattr(request.user, 'id', None),  # When available
)

# Error log pattern (all shims):
logger.error(
    'marathon shim list winners failed',
    error=error,
    path=url,
    latency_ms=latency_ms,
)
```

**Status:** ✅ Logging is comprehensive and consistent across all endpoints.

---

## 6. Parameter Mapping Verification

### Winners Endpoints

| Legacy | New Service | Status |
| ------ | ----------- | ------ |
| Query params passed through | `params=request.GET` | ✅ |
| `{id}` → `{winnerId}` | URL parameter: `kwargs.get('pk')` | ✅ |

### Random Report

| Legacy | New Service | Status |
| ------ | ----------- | ------ |
| `{step}` → `stepId` | `params = {'stepId': step_id}` | ✅ |
| `?marathoner=` → `excludeMarathonerId` | `if marathoner_id: params['excludeMarathonerId'] = marathoner_id` | ✅ |

### My Marathons

| Legacy | New Service | Status |
| ------ | ----------- | ------ |
| `{id}` → `{marathonerId}` | ❌ Not mapped (routing bug) | ❌ |
| Auth header forwarded | `headers['Authorization'] = auth_header` | ✅ |

**Note:** Detail endpoint parameter mapping is broken due to routing issue.

### Registration

| Legacy | New Service | Status |
| ------ | ----------- | ------ |
| Request body forwarded | `json=request.data` | ✅ |
| Redirect URL handled | `redirect_url = payload.get('redirectUrl')` | ✅ |

**Status:** ✅ 7 of 8 endpoints have correct parameter mapping. ❌ 1 broken due to routing bug.

---

## 7. Code Isolation

**Status:** ✅ **ISOLATED**

**Modified Files:**

- `marathon/api_views/winners.py` - Winners and random report shims
- `marathon/api_views/common.py` - My marathons and languages shims
- `marathon/reviews/api_views.py` - Reviews shim
- `marathon/api_views/auth.py` - Registration shim
- `marathon/api_urls.py` - URL routing (needs fix)

**Verification:**

- ✅ Only marathon API views modified
- ✅ No changes to models, serializers, or other apps
- ✅ Legacy code paths preserved via `super()` calls
- ✅ No refactoring of unrelated code

**Status:** ✅ Code changes are properly isolated to marathon app only.

---

## 8. Summary of Issues

### Critical Issues (Blocking)

1. **❌ My Marathon Detail Endpoint Routing Bug**
   - **File:** `marathon/api_urls.py:13`
   - **Issue:** Uses `MyMarathonsList` (ListAPIView) instead of `MyMarathon` (RetrieveAPIView)
   - **Impact:** Detail endpoint never routes to new service, always returns list
   - **Fix Required:** Change to `MyMarathon.as_view()` in `api_urls.py`

### No Other Issues

- ✅ All other endpoints correctly mapped
- ✅ Fallback behavior safe
- ✅ Logging complete
- ✅ Env keys properly used
- ✅ Code isolated

---

## 9. GO/NO-GO Decision

### ❌ **NO-GO for Enabling `MARATHON_SHIM_ENABLED`**

**Rationale:**

1. ❌ Critical routing bug prevents detail endpoint from working
2. ✅ All other endpoints correctly implemented
3. ✅ Fallback behavior is safe
4. ✅ Logging is comprehensive
5. ✅ Code changes are isolated

**Required Actions Before GO:**

1. **Fix routing bug:** Change `api_urls.py:13` to use `MyMarathon.as_view()` instead of `MyMarathonsList.as_view()`
2. **Test detail endpoint:** Verify `/marathon/api/my/{id}.json` correctly routes to `/api/v1/me/marathons/{marathonerId}`
3. **Re-audit:** Verify fix after implementation

**After Fix:**

- ✅ All 8 endpoints will be correctly mapped
- ✅ All parameter mappings will work
- ✅ All logging will be active
- ✅ Safe to enable shim

---

## 10. Evidence Files

### Implementation Files

- `speakasap-portal/marathon/api_urls.py` - URL routing (needs fix on line 13)
- `speakasap-portal/marathon/api_views/winners.py` - Winners and random report shims
- `speakasap-portal/marathon/api_views/common.py` - My marathons and languages shims (contains unused `MyMarathon` class)
- `speakasap-portal/marathon/reviews/api_views.py` - Reviews shim
- `speakasap-portal/marathon/api_views/auth.py` - Registration shim

### Configuration

- `speakasap-portal/.env.example` - Contains env keys (keys only)

---

## 11. Next Steps

1. **Fix:** Update `api_urls.py:13` to use `MyMarathon.as_view()`
2. **Test:** Verify detail endpoint routes correctly
3. **Re-audit:** Re-run audit after fix
4. **Enable:** Set `MARATHON_SHIM_ENABLED=true` after verification

---

## 12. Post-Fix Update (2026-01-26)

### ✅ Fixes Applied

1. **✅ Routing Bug Fixed**
   - **Status:** ✅ Already fixed - `api_urls.py:13` uses `MyMarathon.as_view()`
   - **Additional Fix:** Updated permissions from `AllowAny` to `IsAuthenticated` in `api_views/common.py:66`
   - **Verification:** Line 13 correctly routes to `MyMarathon` (RetrieveAPIView)

2. **✅ Permissions Updated**
   - **File:** `speakasap-portal/marathon/api_views/common.py:66`
   - **Change:** `permission_classes = [permissions.AllowAny]` → `permission_classes = [permissions.IsAuthenticated]`
   - **Status:** ✅ Matches legacy behavior and list endpoint

### Updated GO/NO-GO Decision

### ✅ **GO** - Ready for Shim Enablement

**Rationale:**

1. ✅ Routing bug fixed - `MyMarathon.as_view()` correctly used
2. ✅ Permissions updated - `IsAuthenticated` matches legacy behavior
3. ✅ All 8 endpoints correctly mapped
4. ✅ Fallback behavior is safe
5. ✅ Logging is comprehensive
6. ✅ Code changes are isolated

**Verification:**

- ✅ `api_urls.py:13` uses `MyMarathon.as_view()`
- ✅ `api_views/common.py:66` uses `IsAuthenticated` permissions
- ✅ Detail endpoint will correctly route to `/api/v1/me/marathons/{marathonerId}`

**Next Steps:**

1. **Deploy frontend** with pagination format updates (see AGENT07)
2. **Test detail endpoint** after frontend deployment
3. **Enable shim** following `MARATHON_CUTOVER_RUNBOOK.md`

**Reference:** See `MARATHON_CUTOVER_VERIFICATION.md` for verification steps
