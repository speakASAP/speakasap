# TASK-15: Configure Environment Variables in speakasap-portal

## Status
- **Phase**: Phase 2 - speakasap-portal refactoring
- **Priority**: Critical (required for microservice connection)
- **Dependencies**: None
- **Estimated Time**: 30 minutes

## Objective
Add payments-microservice configuration to speakasap-portal settings and environment files.

## Prerequisites
- speakasap-portal codebase available
- Settings files exist: `portal/local_settings.py` and `portal/local_settings_default.py`
- `.env` file exists (if used)

## Implementation Steps

### 1. Backup Existing Settings Files
**Files**: `speakasap-portal/portal/local_settings.py`

- Create backup: `cp local_settings.py local_settings.py.backup` or `local_settings.py.backup.$(date +%Y%m%d)`
- Verify backup was created

### 2. Add Payments Microservice Configuration
**File**: `speakasap-portal/portal/local_settings.py`

- Add payments-microservice configuration:
  ```python
  # Payments Microservice Configuration
  PAYMENT_SERVICE_URL = os.environ.get('PAYMENT_SERVICE_URL', 'https://payments.statex.cz')
  PAYMENT_API_KEY = os.environ.get('PAYMENT_API_KEY', '')
  ```
- Use environment variables with defaults
- Import `os` if not already imported

### 3. Update Default Settings
**File**: `speakasap-portal/portal/local_settings_default.py`

- Add same configuration with default values:
  ```python
  # Payments Microservice Configuration
  PAYMENT_SERVICE_URL = os.environ.get('PAYMENT_SERVICE_URL', 'https://payments.statex.cz')
  PAYMENT_API_KEY = os.environ.get('PAYMENT_API_KEY', '')
  ```
- Document purpose of each setting

### 4. Update .env File (if used)
**File**: `speakasap-portal/.env`

- Backup existing `.env` file first
- Add payments-microservice variables:
  ```
  PAYMENT_SERVICE_URL=https://payments.statex.cz
  PAYMENT_API_KEY=<api-key-value>
  ```
- Use actual values for production/staging
- Keep values secure (not in git)

### 5. Update .env.example File
**File**: `speakasap-portal/.env.example`

- Add variable names (keys only, NO values):
  ```
  # Payments Microservice Configuration
  PAYMENT_SERVICE_URL=
  PAYMENT_API_KEY=
  ```
- Document purpose of each variable

### 6. Add Logging Configuration (if applicable)
**File**: `speakasap-portal/.env` and `.env.example`

- If centralized logging service is used, add logging configuration:
  ```
  # Logging Microservice Configuration (if used)
  LOGGING_SERVICE_URL=http://logging-microservice:3367
  ```
- Document logging configuration in `.env.example` comments
- Ensure logging service connection is properly configured for development and production use

## Files to Modify

1. `speakasap-portal/portal/local_settings.py` (backup first)
2. `speakasap-portal/portal/local_settings_default.py`
3. `speakasap-portal/.env` (backup first, if used)
4. `speakasap-portal/.env.example` (if used)

## Configuration Variables

- `PAYMENT_SERVICE_URL` - Base URL for payments-microservice (e.g., `https://payments.statex.cz`)
- `PAYMENT_API_KEY` - API key for authenticating requests to payments-microservice

## Acceptance Criteria

- [ ] Settings files are backed up before modification
- [ ] `PAYMENT_SERVICE_URL` is added to settings
- [ ] `PAYMENT_API_KEY` is added to settings
- [ ] Settings use environment variables with defaults
- [ ] `.env` file is updated (if used)
- [ ] `.env.example` has variable names (keys only)
- [ ] Configuration is documented
- [ ] Code compiles without errors
- [ ] Logging service configuration is added (if centralized logging is used)

## Verification Steps (for Orchestrating Agent)

1. **Settings Check**:
   - [ ] Verify backup files exist
   - [ ] Check `PAYMENT_SERVICE_URL` is added to `local_settings.py`
   - [ ] Verify `PAYMENT_API_KEY` is added to `local_settings.py`
   - [ ] Check settings use environment variables
   - [ ] Verify default values are set

2. **Environment Check**:
   - [ ] Check `.env` file has variables (if used)
   - [ ] Verify `.env.example` has variable names (keys only)
   - [ ] Confirm values are not in `.env.example`

3. **Integration Check**:
   - [ ] Verify settings can be imported: `from django.conf import settings`
   - [ ] Check `settings.PAYMENT_SERVICE_URL` is accessible
   - [ ] Verify `settings.PAYMENT_API_KEY` is accessible
   - [ ] Test environment variable override works

4. **Security Check**:
   - [ ] Verify `.env` is excluded from git (if used)
   - [ ] Check API key is not hardcoded
   - [ ] Confirm sensitive values are in environment variables

5. **Documentation Check**:
   - [ ] Verify configuration is documented
   - [ ] Check variable purposes are explained

## Notes

- Settings use environment variables for flexibility
- Default values allow local development without .env
- API key should be retrieved from secure storage (production)
- Keep configuration consistent across environments
- Document any environment-specific values

## Related Tasks
- TASK-09: Refactor PaymentFactory (uses these settings)
- TASK-14: Add Webhook Endpoint (uses PAYMENT_API_KEY for webhook auth)
