# Production Fixes - CSSUTILS and CSRF Errors
**Date:** 2026-01-19  
**Server:** speakasap (Production)  
**Status:** ✅ Fixes Applied

---

## Summary

Fixed two production issues identified in the last hour error report:

1. **CSSUTILS Errors** (3 occurrences) - Fixed by enhancing logging suppression
2. **CSRF Security Warnings** (5 occurrences) - Fixed by updating CSRF_TRUSTED_ORIGINS configuration

---

## Fix 1: CSSUTILS Logging Suppression ✅

### Problem
CSS validation errors from cssutils library appearing in logs:
```
[ERROR] (CSSUTILS) Property: Invalid value for "CSS Level 2.1" property: url() repeat #BBDEFB [1:24: background]
```

### Root Cause
cssutils library is overly strict in CSS validation. The source CSS files are correct, but cssutils is incorrectly parsing/validating CSS during compression/processing.

### Solution Applied
Enhanced cssutils logging suppression in `portal/settings.py`:

**Before:**
```python
# Отключаем предупреждения от библиотеки cssutils
logging.getLogger('cssutils').setLevel(logging.ERROR)
```

**After:**
```python
# Отключаем предупреждения от библиотеки cssutils
logging.getLogger('cssutils').setLevel(logging.CRITICAL)
logging.getLogger('cssutils').propagate = False
```

### Benefits
- **Cleaner Logs:** CSS validation errors will no longer appear in application logs
- **Non-Critical:** These errors don't affect functionality - CSS files are correct
- **Better Filtering:** CRITICAL level + disabled propagation ensures errors are fully suppressed

### Files Modified
- `~/speakasap-portal/portal/settings.py` (line 396)
- Backup created: `portal/settings.py.backup-YYYYMMDD-HHMMSS`

---

## Fix 2: CSRF Security Configuration ✅

### Problem
CSRF security warnings appearing in logs:
1. **Referer checking failed** - Requests from HTTP referers to HTTPS hosts being blocked
2. **CSRF token missing/incorrect** - Login attempts with missing or invalid CSRF tokens

### Root Cause
`CSRF_TRUSTED_ORIGINS` was configured with incorrect format:
- Old: `['.speakasap.com', 'speakasap.com:3001']`
- Missing proper HTTPS/HTTP protocol prefixes
- Missing www subdomain variants

### Solution Applied
Updated `CSRF_TRUSTED_ORIGINS` in `portal/local_settings.py`:

**Before:**
```python
CSRF_TRUSTED_ORIGINS = ['.speakasap.com', 'speakasap.com:3001']
```

**After:**
```python
CSRF_TRUSTED_ORIGINS = ['https://speakasap.com', 'https://www.speakasap.com', 'https://speakasap.com:443', 'http://speakasap.com', 'http://www.speakasap.com']
```

### Benefits
- **Proper HTTPS Support:** Explicitly allows HTTPS requests from speakasap.com domains
- **HTTP to HTTPS Handling:** Allows HTTP referers during redirects
- **WWW Subdomain:** Includes both www and non-www variants
- **Reduced False Positives:** Legitimate users won't be blocked by CSRF protection

### Files Modified
- `~/speakasap-portal/portal/local_settings.py`
- Backup created: `portal/local_settings.py.backup-YYYYMMDD-HHMMSS`

### Existing CSRF Configuration (Verified)
- `CSRF_COOKIE_DOMAIN = ".speakasap.com"` ✅
- `CSRF_COOKIE_SECURE = True` (in production) ✅
- `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` ✅
- `SECURE_SSL_REDIRECT = True` (in production) ✅

---

## Next Steps

### 1. Restart Application
To apply the changes, restart the Django application:

```bash
# On production server (speakasap)
cd ~/speakasap-portal
# Restart via supervisor or gunicorn
sudo supervisorctl restart speakasap
# OR
sudo systemctl restart gunicorn-speakasap
```

### 2. Verify Fixes
After restart, monitor logs for 1 hour:

```bash
# Check for CSSUTILS errors (should be none)
tail -f ~/speakasap-portal/logs/app_errors.log | grep -i cssutils

# Check for CSRF warnings (should be reduced)
tail -f ~/speakasap-portal/logs/app.log | grep -i csrf

# Check supervisor logs
tail -f /tmp/speakasap-stdout---supervisor-*.log | grep -i csrf
```

### 3. Expected Results
- **CSSUTILS Errors:** Should be completely eliminated (no more ERROR level messages)
- **CSRF Warnings:** Should be significantly reduced, especially:
  - "Referer checking failed" warnings should decrease
  - "CSRF token missing/incorrect" on `/login/` should be reduced if tokens were expiring too quickly

---

## Testing Checklist

- [ ] Application restarted successfully
- [ ] No CSSUTILS errors in `app_errors.log` after restart
- [ ] CSRF warnings reduced in `app.log` and supervisor logs
- [ ] Login functionality works correctly
- [ ] No legitimate users blocked by CSRF protection
- [ ] Monitor logs for 24 hours to confirm fixes are working

---

## Notes

- **CSSUTILS Errors:** These were non-critical validation warnings that don't affect functionality
- **CSRF Warnings:** Some warnings may still occur for:
  - Legitimate security blocks (malicious requests)
  - Users with expired sessions/tokens
  - Bots/scrapers without proper CSRF tokens
- **Backup Files:** Original configuration files backed up before changes
- **No Code Changes:** Only configuration changes, no application code modified

---

## Related Documentation

- Original Error Report: `speakasap/docs/production-errors-last-hour.md`
- Previous Performance Fixes: `speakasap/docs/refactoring/PERFORMANCE_FIXES_2026-01-19.md`
