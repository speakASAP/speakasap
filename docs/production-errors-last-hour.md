# Production Server Errors - Last Hour Report
**Generated:** 2026-01-19 17:59:45 CET  
**Time Range:** 2026-01-19 16:59:45 - 17:59:45 CET

## Summary
Total errors found in the last hour: **8 errors/warnings**

---

## Error Details

### 1. CSSUTILS Errors (3 occurrences)
**Time:** 2026-01-19 16:36:58  
**Log File:** `~/speakasap-portal/logs/app_errors.log`  
**Severity:** ERROR  
**Count:** 3

**Error Message:**
```
[ERROR] (CSSUTILS) Property: Invalid value for "CSS Level 2.1" property: url() repeat #BBDEFB [1:24: background]
[ERROR] (CSSUTILS) Property: Invalid value for "CSS Level 2.1" property: url() repeat #BBDEFB [1:1: background]
[ERROR] (CSSUTILS) Property: Invalid value for "CSS Level 2.1" property: url() repeat #BBDEFB [1:13: background]
```

**Description:** Invalid CSS background property values detected. The CSS parser is rejecting background properties with `url() repeat #BBDEFB` format.

**Impact:** Low - CSS parsing warnings, may affect email template rendering

---

### 2. CSRF Security Warnings (5 occurrences)
**Time Range:** 2026-01-19 17:55:00 - 18:56:13  
**Log Files:** 
- `~/speakasap-portal/logs/app.log`
- `/tmp/speakasap-stdout---supervisor-4Yi4vo.log`  
**Severity:** WARNING  
**Count:** 5

**Error Messages:**

1. **2026-01-19 17:55:00**
   ```
   [WARNING] (django.security.csrf) Forbidden (Referer checking failed - Referer is insecure while host is secure.): /
   ```

2. **2026-01-19 18:03:21** (2 occurrences)
   ```
   [WARNING] (django.security.csrf) Forbidden (Referer checking failed - Referer is insecure while host is secure.): /
   ```

3. **2026-01-19 18:44:24** (2 occurrences)
   ```
   [WARNING] (django.security.csrf) Forbidden (CSRF token missing or incorrect.): /login/
   ```

4. **2026-01-19 18:50:41** (2 occurrences)
   ```
   [WARNING] (django.security.csrf) Forbidden (Referer checking failed - Referer is insecure while host is secure.): /
   ```

5. **2026-01-19 18:56:13** (2 occurrences)
   ```
   [WARNING] (django.security.csrf) Forbidden (Referer checking failed - Referer is insecure while host is secure.): /
   ```

**Description:** 
- **Referer checking failed:** Requests coming from insecure (HTTP) referers to secure (HTTPS) hosts are being blocked
- **CSRF token missing/incorrect:** Login attempts with missing or invalid CSRF tokens

**Impact:** Medium - Legitimate users may be blocked if accessing from HTTP referers or with expired CSRF tokens

**IP Addresses Affected:**
- Multiple IPs attempting to access `/` and `/login/` endpoints

---

## Logs Checked

### Application Logs
- ✅ `~/speakasap-portal/logs/app_errors.log`
- ✅ `~/speakasap-portal/logs/app.log`
- ✅ `~/speakasap-portal/logs/http_errors.log`
- ✅ `~/speakasap-portal/logs/helpdesk.log`
- ✅ `~/speakasap-portal/logs/payment.log`
- ✅ `~/speakasap-portal/logs/ses.log`
- ✅ `~/speakasap-portal/logs/webpay.log`
- ✅ `~/speakasap-portal/logs/discount.log`

### System Logs
- ✅ `/var/log/nginx/error.log` - No errors in last hour
- ✅ `/var/log/gunicorn/error_log_speakasap` - No errors in last hour
- ✅ `/tmp/supervisord.log` - No errors in last hour
- ✅ `/var/log/postgresql/postgresql-9.5-main.log` - No slow queries (>2s) in last hour

### Celery/Supervisor Task Logs
- ✅ `/tmp/speakasap-stdout---supervisor-4Yi4vo.log` - CSRF warnings found
- ✅ `/tmp/speakasap-stderr---supervisor-*.log` - Checked (no files found or no errors)

---

## Recommendations

### 1. CSSUTILS Errors
- **Action:** Review email templates and CSS generation code
- **Priority:** Low
- **Location:** Check CSS background property formatting in email templates

### 2. CSRF Security Warnings
- **Action:** Review CSRF configuration and referer checking settings
- **Priority:** Medium
- **Considerations:**
  - Verify if HTTP to HTTPS redirects are properly configured
  - Check if CSRF token expiration time is too short
  - Review if legitimate traffic is being blocked
  - Consider adjusting `CSRF_TRUSTED_ORIGINS` if needed

---

## Notes
- No critical errors (fatal/critical) found in the last hour
- No database slow queries (>2s) detected
- No Gunicorn worker errors
- No Nginx errors
- System appears stable with only minor warnings
