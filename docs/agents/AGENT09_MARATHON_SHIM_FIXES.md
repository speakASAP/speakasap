# AGENT09: Marathon Shim Audit Fixes

## Role

Integration Adapter Agent responsible for fixing identified issues in the marathon legacy shim implementation.

## Objective

Fix the routing bug and validate ID format compatibility in the marathon shim layer as documented in `MARATHON_LEGACY_SHIM_AUDIT.md`.

---

## Issues to Fix

### Issue 1: Routing Bug - My Marathon Detail Endpoint

**Problem:**

- `api_urls.py` uses `MyMarathonsList` (ListAPIView) for both `my.json` and `my/(?P<pk>\d+)\.json`
- The detail endpoint `GET /api/v1/me/marathons/{marathonerId}` is never called
- `MyMarathon` (RetrieveAPIView) exists but is not used

**Location:**

- `speakasap-portal/marathon/api_urls.py:13`
- `speakasap-portal/marathon/api_views/common.py` (contains unused `MyMarathon` class)

**Required Fix:**

- Change `api_urls.py:13` to use `MyMarathon.as_view()` instead of `MyMarathonsList.as_view()`
- Verify `MyMarathon` class has correct shim implementation
- Ensure permissions are correct (`IsAuthenticated`)

**Reference:**

- `docs/refactoring/MARATHON_LEGACY_SHIM_AUDIT.md` section 2.1
- `docs/agents/AGENT08_LEGACY_SHIM_AUDIT_REPORT.md` section 2

---

### Issue 2: ID Format Validation

**Problem:**

- Legacy endpoints use numeric IDs (`\d+`)
- New service may use UUIDs
- Need to validate compatibility

**Locations:**

- `winners/{id}` endpoint
- `my/{id}` endpoint
- `random_report/{step}` endpoint

**Required Actions:**

- Check if new service uses UUIDs or numeric IDs
- If UUIDs: Document migration path or add ID transformation
- If numeric: Verify compatibility
- Test with real IDs from legacy system

**Reference:**

- `docs/refactoring/MARATHON_LEGACY_SHIM_AUDIT.md` section 2.2
- `docs/refactoring/MARATHON_DATA_MAPPING.md` - Check ID field types

---

## Inputs

- `docs/refactoring/MARATHON_LEGACY_SHIM_AUDIT.md` - Issue documentation
- `docs/agents/AGENT08_LEGACY_SHIM_AUDIT_REPORT.md` - Full audit report
- `speakasap-portal/marathon/api_urls.py` - URL routing file
- `speakasap-portal/marathon/api_views/common.py` - MyMarathon implementation
- `docs/refactoring/MARATHON_DATA_MAPPING.md` - Data mapping (ID types)
- Marathon service schema: `/Users/sergiystashok/Documents/GitHub/marathon/prisma/schema.prisma`

## Scope

- Fix routing bug in `api_urls.py`
- Verify `MyMarathon` implementation is correct
- Validate ID format compatibility
- Add logging for ID transformations (if needed)
- Test fixes with actual endpoint calls

## Do

- Fix routing to use `MyMarathon.as_view()` for detail endpoint
- Verify `MyMarathon` class has correct shim implementation
- Check ID field types in Prisma schema
- Validate ID format compatibility
- Add ID transformation logic if UUIDs are used (legacy numeric → new UUID)
- Add extensive logging for ID transformations
- Test all affected endpoints
- Update documentation with findings

## Do Not

- Do not modify marathon service code (only shim layer)
- Do not change legacy URL patterns
- Do not modify other shim endpoints unnecessarily
- Do not create automated tests
- Do not skip ID format validation

## Outputs

- Fixed `speakasap-portal/marathon/api_urls.py` - Routing corrected
- Updated `speakasap-portal/marathon/api_views/common.py` - If `MyMarathon` needs updates
- `docs/refactoring/MARATHON_ID_FORMAT_VALIDATION.md` - ID format validation report
- Updated shim logging (if ID transformations added)

## Exit Criteria

- Routing bug fixed and verified
- `MyMarathon` detail endpoint correctly routes to new service
- ID format compatibility validated
- All affected endpoints tested
- Documentation updated

## Verification Steps

1. **Test Detail Endpoint:**

   ```bash
   # Should route to GET /api/v1/me/marathons/{marathonerId}
   curl -H "Authorization: Bearer TOKEN" \
        https://speakasap.com/marathon/api/my/123.json
   ```

2. **Check Logs:**

   ```bash
   # Should show shim forwarding to detail endpoint
   grep "marathon shim get my marathon" /path/to/logs
   ```

3. **Verify ID Format:**
   - Check Prisma schema for ID field types
   - Test with legacy numeric IDs
   - Verify transformation works (if needed)

## Related

- Audit report: `docs/agents/AGENT08_LEGACY_SHIM_AUDIT_REPORT.md`
- Audit document: `docs/refactoring/MARATHON_LEGACY_SHIM_AUDIT.md`
- Shim verification: `docs/refactoring/SPEAKASAP_PORTAL_SHIM_VERIFICATION.md`
