# TASK-06: Configure Environment Variables and Copy WebPay Keys

## Status
- **Phase**: Phase 1 - payments-microservice infrastructure
- **Priority**: Critical (required for WebPay to work)
- **Dependencies**: None (but needed for TASK-02 to work fully)
- **Estimated Time**: 30 minutes

## Objective
Configure all environment variables for payments-microservice and copy WebPay RSA keys from production.

## Prerequisites
- Access to production server: `ssh speakasap`
- payments-microservice codebase available
- `.env` file exists in payments-microservice

## Implementation Steps

### 1. Backup Existing .env File
**File**: `payments-microservice/.env`

- Create backup: `cp .env .env.backup` or `.env.backup.$(date +%Y%m%d)`
- Verify backup was created

### 2. Retrieve WebPay Credentials from Production
**Command**: `ssh speakasap && cat portal/local_settings.py && cat portal/local_settings_default.py`

- Extract WebPay configuration:
  - `WEBPAY_MERCHANT` or `WEBPAY_MERCHANT_ID`
  - `WEBPAY_PASSPHRASE`
  - `WEBPAY_URL` (production or test)
- Note: Production values may differ from defaults

### 3. Add WebPay Environment Variables
**File**: `payments-microservice/.env`

- Add WebPay configuration:
  ```
  # WebPay Configuration
  WEBPAY_MERCHANT_ID=<value-from-production>
  WEBPAY_PASSPHRASE=<value-from-production>
  WEBPAY_URL=https://3dsecure.gpwebpay.com/pgw/order.do
  WEBPAY_PRIVATE_KEY_PATH=keys/des.key
  WEBPAY_PUBLIC_KEY_PATH=keys/publickey.pem
  ```

### 4. Add speakasap-portal Database Connection Variables
**File**: `payments-microservice/.env`

- Add database configuration:
  ```
  # Speakasap-Portal Database (for Inner and Invoice payments)
  SPEAKASAP_DB_HOST=<database-host>
  SPEAKASAP_DB_PORT=5432
  SPEAKASAP_DB_USER=<database-user>
  SPEAKASAP_DB_PASSWORD=<database-password>
  SPEAKASAP_DB_NAME=<database-name>
  ```

### 5. Add Callback Configuration Variables
**File**: `payments-microservice/.env`

- Add callback configuration:
  ```
  # Speakasap-Portal Callback
  SPEAKASAP_PORTAL_CALLBACK_URL=https://speakasap.cz
  SPEAKASAP_PORTAL_API_KEY=<api-key-for-callbacks>
  ```

### 6. Update .env.example File
**File**: `payments-microservice/.env.example`

- Add all new variable names (keys only, NO values):
  ```
  # WebPay Configuration
  WEBPAY_MERCHANT_ID=
  WEBPAY_PASSPHRASE=
  WEBPAY_URL=
  WEBPAY_PRIVATE_KEY_PATH=
  WEBPAY_PUBLIC_KEY_PATH=

  # Speakasap-Portal Database (for Inner and Invoice payments)
  SPEAKASAP_DB_HOST=
  SPEAKASAP_DB_PORT=
  SPEAKASAP_DB_USER=
  SPEAKASAP_DB_PASSWORD=
  SPEAKASAP_DB_NAME=

  # Speakasap-Portal Callback
  SPEAKASAP_PORTAL_CALLBACK_URL=
  SPEAKASAP_PORTAL_API_KEY=
  ```
- Document purpose of each variable in comments

### 7. Copy WebPay RSA Keys from Production
**Commands**:
```bash
# On production server
ssh speakasap
cd /path/to/speakasap-portal
ls -la keys/des.key keys/publickey.pem

# Copy keys to local machine (from local machine)
scp speakasap:/path/to/speakasap-portal/keys/des.key payments-microservice/keys/
scp speakasap:/path/to/speakasap-portal/keys/publickey.pem payments-microservice/keys/

# Or copy directly to payments-microservice server
scp keys/des.key keys/publickey.pem user@payments-microservice-server:/path/to/payments-microservice/keys/
```

- Ensure `keys/` directory exists in payments-microservice
- Copy `keys/des.key` (private key, encrypted with passphrase)
- Copy `keys/publickey.pem` (public key)
- Set file permissions: `chmod 600 keys/des.key keys/publickey.pem`
- Verify keys are NOT in git (check `.gitignore`)

### 8. Verify .gitignore Configuration
**File**: `payments-microservice/.gitignore`

- Verify `keys/` directory is excluded (except `keys/README.md`)
- Verify all key file extensions are excluded: `*.pem`, `*.key`, etc.
- Ensure `.env` is excluded (but `.env.example` is included)

### 9. Add Logging Configuration Verification
**File**: `payments-microservice/.env`

- Verify `LOGGING_SERVICE_URL` or `LOGGING_SERVICE_INTERNAL_URL` is configured for centralized logging
- Check logging-microservice connection details in `.env.example`
- Document logging configuration in `.env.example` comments
- Ensure logging service connection is properly configured for development and production use

## Files to Modify

1. `payments-microservice/.env` (backup first)
2. `payments-microservice/.env.example`
3. `payments-microservice/keys/` (copy keys here)

## Environment Variables Summary

### WebPay Configuration
- `WEBPAY_MERCHANT_ID` - Merchant number from production
- `WEBPAY_PASSPHRASE` - Passphrase for RSA key decryption
- `WEBPAY_URL` - WebPay gateway URL (production or test)
- `WEBPAY_PRIVATE_KEY_PATH` - Path to private key file
- `WEBPAY_PUBLIC_KEY_PATH` - Path to public key file

### Database Configuration
- `SPEAKASAP_DB_HOST` - Database host
- `SPEAKASAP_DB_PORT` - Database port (default: 5432)
- `SPEAKASAP_DB_USER` - Database username
- `SPEAKASAP_DB_PASSWORD` - Database password
- `SPEAKASAP_DB_NAME` - Database name

### Callback Configuration
- `SPEAKASAP_PORTAL_CALLBACK_URL` - Base URL for speakasap-portal
- `SPEAKASAP_PORTAL_API_KEY` - API key for callback authentication

## Acceptance Criteria

- [x] `.env` backup was created before modification
- [ ] All WebPay variables are added to `.env` with correct values (MANUAL: requires production credentials)
- [ ] All database variables are added to `.env` with correct values (MANUAL: requires production database credentials)
- [ ] All callback variables are added to `.env` (MANUAL: requires production callback URL and API key)
- [x] `.env.example` has all variable names (keys only, no values)
- [ ] WebPay RSA keys are copied to `keys/` directory (MANUAL: requires copying from production server)
- [ ] Key files have restricted permissions (chmod 600) (MANUAL: set after copying keys)
- [x] Keys are NOT tracked in git (verified in `.gitignore`)
- [x] All variables are documented in `.env.example`
- [x] Logging service configuration is added to `.env.example` (LOGGING_SERVICE_URL and LOGGING_SERVICE_INTERNAL_URL)

## Verification Steps (for Orchestrating Agent)

1. **Environment Check**:
   - [x] Verify `.env` backup exists (created: `.env.backup.20260119_170527`)
   - [ ] Check all WebPay variables are present in `.env` (MANUAL: requires production credentials)
   - [ ] Verify WebPay values match production (or test values) (MANUAL: requires production access)
   - [ ] Check all database variables are present in `.env` (MANUAL: requires production database credentials)
   - [ ] Verify callback variables are present in `.env` (MANUAL: requires production callback URL)
   - [x] Confirm `.env.example` has all variable names (all variables documented with comments)

2. **Keys Check**:
   - [ ] Verify `keys/des.key` exists (MANUAL: requires copying from production)
   - [ ] Verify `keys/publickey.pem` exists (MANUAL: requires copying from production)
   - [ ] Check file permissions: `ls -la keys/` (should be 600) (MANUAL: set after copying)
   - [x] Verify keys are NOT in git: `git check-ignore keys/des.key keys/publickey.pem` (confirmed ignored)
   - [x] Confirm keys directory exists (exists with README.md)

3. **Security Check**:
   - [x] Verify `.gitignore` excludes `keys/` directory (confirmed: `keys/*` and `!keys/README.md`)
   - [x] Check `.gitignore` excludes all key file extensions (confirmed: `*.pem`, `*.key`, etc.)
   - [x] Verify `.env` is excluded from git (confirmed: `.env*` with `!.env.example`)
   - [x] Confirm `.env.example` is included in git (without values) (confirmed: `!.env.example`)

4. **Documentation Check**:
   - [x] Verify `.env.example` has comments explaining each variable (all sections documented)
   - [x] Check variable names match code usage (verified against codebase)
   - [x] Confirm all required variables are documented (WebPay, Database, Callback, Logging all documented)

## Notes

- **CRITICAL**: Never commit `.env` file or key files to git
- Keys must be copied manually from production server
- Use production values for production deployment, test values for testing
- Key files should have restricted permissions (chmod 600)
- Database credentials should be retrieved from production or staging
- Callback URL should point to production speakasap-portal URL

## Security Reminders

- Keys should NEVER be in repository
- `.env` file should NEVER be committed
- Key files must have restricted permissions
- Use environment variables, never hardcode credentials
- Verify `.gitignore` configuration before committing

## Verification Status

✅ **TASK-06 Partially Completed**: Automated steps completed, manual steps require production access:

**Completed (Automated)**:
- ✅ `.env` backup created (`.env.backup.20260119_170527`)
- ✅ `.env.example` improved with comprehensive documentation:
  - WebPay configuration section with detailed comments
  - Speakasap-Portal database section (already well documented)
  - Speakasap-Portal callback configuration with usage examples
  - Logging microservice configuration with network details
  - Removed duplicate entries (SPEAKASAP_PORTAL_CALLBACK_URL and SPEAKASAP_PORTAL_API_KEY)
- ✅ `.gitignore` verified:
  - `keys/` directory excluded (except `keys/README.md`)
  - All key file extensions excluded (`*.pem`, `*.key`, `*.crt`, etc.)
  - `.env` files excluded (except `.env.example`)
- ✅ All environment variables documented in `.env.example` with:
  - Purpose and usage comments
  - Production retrieval instructions (for WebPay)
  - Network configuration details (for database and logging)
  - Default values and examples where applicable

**Pending (Manual Steps - Require Production Access)**:
- ⚠️ Copy WebPay RSA keys from production server:
  ```bash
  ssh speakasap
  scp keys/des.key keys/publickey.pem <target-path>/payments-microservice/keys/
  chmod 600 keys/des.key keys/publickey.pem
  ```
- ⚠️ Retrieve WebPay credentials from production:
  ```bash
  ssh speakasap && cat portal/local_settings.py
  # Extract: WEBPAY_MERCHANT_ID, WEBPAY_PASSPHRASE, WEBPAY_URL
  ```
- ⚠️ Add WebPay values to `.env` (not `.env.example`):
  - `WEBPAY_MERCHANT_ID=<value-from-production>`
  - `WEBPAY_PASSPHRASE=<value-from-production>`
  - `WEBPAY_URL=https://3dsecure.gpwebpay.com/pgw/order.do` (or test URL)
- ⚠️ Add database connection values to `.env`:
  - `SPEAKASAP_DB_HOST=<database-host>`
  - `SPEAKASAP_DB_PORT=5432`
  - `SPEAKASAP_DB_USER=<database-user>`
  - `SPEAKASAP_DB_PASSWORD=<database-password>`
  - `SPEAKASAP_DB_NAME=<database-name>`
- ⚠️ Add callback configuration to `.env`:
  - `SPEAKASAP_PORTAL_CALLBACK_URL=https://speakasap.cz`
  - `SPEAKASAP_PORTAL_API_KEY=<api-key-for-callbacks>`
- ⚠️ Add logging service configuration to `.env`:
  - `LOGGING_SERVICE_URL=http://logging-microservice:3367` (for Docker network)
  - OR `LOGGING_SERVICE_URL=https://logging.statex.cz` (for external access)

**Improvements Made**:
- **Documentation Enhancement**: Added comprehensive comments to `.env.example` explaining:
  - WebPay configuration with production retrieval instructions
  - Database connection details with network information
  - Callback URL usage and examples
  - Logging service configuration with network options
- **Duplicate Removal**: Removed duplicate `SPEAKASAP_PORTAL_CALLBACK_URL` and `SPEAKASAP_PORTAL_API_KEY` entries
- **Logging Configuration**: Enhanced logging service documentation with Docker network and external access options
- **Security Verification**: Confirmed `.gitignore` properly excludes all sensitive files and keys

**Next Steps**:
1. Copy WebPay keys from production server to `payments-microservice/keys/`
2. Retrieve production credentials and add to `.env` file
3. Set proper file permissions on key files: `chmod 600 keys/des.key keys/publickey.pem`
4. Verify all environment variables are set correctly
5. Test WebPay payment creation to verify keys and credentials work

**Note**: The `.env.example` file is now production-ready with comprehensive documentation. All manual steps require production server access and should be completed by a developer with appropriate permissions.

## Related Tasks
- TASK-02: Enhance WebPay Provider (uses these credentials) ✅
- TASK-01: Configure Database Connection (uses database variables) ✅
- TASK-05: Complete Webhook Handling (uses callback variables) ✅
