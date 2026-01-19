# TASK-01: Configure Database Connection for speakasap-portal Database

## Status

- **Phase**: Phase 1 - payments-microservice infrastructure
- **Priority**: Critical (foundation for Inner and Invoice providers)
- **Dependencies**: None
- **Estimated Time**: 30 minutes

## Objective

Configure a separate TypeORM DataSource connection in payments-microservice to access the speakasap-portal database for Inner and Invoice payment operations.

## Prerequisites

- Access to speakasap-portal database credentials
- payments-microservice codebase available
- TypeORM already configured in payments-microservice

## Implementation Steps

### 1. Update Database Module

**File**: `payments-microservice/shared/database/database.module.ts`

- Add a custom provider for `SPEAKASAP_DATA_SOURCE` using `useFactory`
- Configure DataSource with `SPEAKASAP_DB_*` environment variables:
  - `SPEAKASAP_DB_HOST`
  - `SPEAKASAP_DB_PORT` (default: 5432)
  - `SPEAKASAP_DB_USER`
  - `SPEAKASAP_DB_PASSWORD`
  - `SPEAKASAP_DB_NAME`
- Mark module as `@Global()` to make provider available throughout the application
- Configure DataSource WITHOUT entities (raw SQL queries only)
- Initialize DataSource and handle connection errors

### 2. Update App Module

**File**: `payments-microservice/src/app.module.ts`

- Ensure DatabaseModule is imported
- Verify DataSource provider is available

### 3. Update Environment Files

**File**: `payments-microservice/.env` and `.env.example`

- Add `SPEAKASAP_DB_*` variables to `.env` (backup first)
- Add variable names (keys only) to `.env.example`
- Document each variable's purpose
- **Configure shared database server connection**:
  - Use `db-server-postgres` as hostname (Docker network)
  - Port from `database-server/.env` (`DB_SERVER_PORT`, default: `5432`)
  - Check `database-server/README.md` for connection details
  - Use command `cat database-server/.env` to see current port configuration
- **Configure logging-microservice connection**: Add `LOGGING_SERVICE_URL` or `LOGGING_SERVICE_INTERNAL_URL` to connect to the external shared logging-microservice (see logging-microservice README.md for connection details)

### 4. Add Extensive Logging
**File**: `payments-microservice/shared/database/database.module.ts`

- Use centralized LoggerService (from `shared/logger/logger.service.ts`) which integrates with external shared logging-microservice
- Log database connection initialization attempts (without credentials)
- Log connection success/failure with context (host, port, database name - no credentials)
- Log connection errors with full context (error message, connection parameters without credentials)
- Log DataSource provider creation and initialization
- **Configure logging-microservice connection**: Ensure `LOGGING_SERVICE_URL` or `LOGGING_SERVICE_INTERNAL_URL` is set in `.env` (see logging-microservice README.md for connection details)
- Log levels: `error` for connection failures, `warn` for warnings, `info` for successful connections, `debug` for detailed initialization flow
- LoggerService automatically sends logs to centralized logging-microservice with fallback to local file logging
- Never log sensitive data (database passwords, credentials, connection strings with passwords)

## Files to Modify

1. `payments-microservice/shared/database/database.module.ts`
2. `payments-microservice/src/app.module.ts`
3. `payments-microservice/.env` (backup first)
4. `payments-microservice/.env.example`

## Acceptance Criteria

- [x] `SPEAKASAP_DATA_SOURCE` provider is created and exported from DatabaseModule
- [x] DataSource is configured with all `SPEAKASAP_DB_*` environment variables
- [x] Module is marked as `@Global()` for application-wide access
- [x] DataSource is initialized without entities (raw SQL only)
- [x] Environment variables are added to `.env` and `.env.example`
- [x] Code compiles without errors (database module compiles correctly)
- [x] DataSource can be injected into services using `@Inject('SPEAKASAP_DATA_SOURCE')`
- [x] Uses centralized LoggerService instead of console.log/console.error (improvement added)
- [x] Extensive logging implemented for database connection operations (initialization, connection attempts, errors)

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [x] Check that `SPEAKASAP_DATA_SOURCE` provider exists in `database.module.ts`
   - [x] Verify DataSource configuration uses all required environment variables
   - [x] Confirm module is marked as `@Global()`
   - [x] Verify DataSource is configured without entities
   - [x] Verify LoggerService is used instead of console.log/console.error (improvement)

2. **Environment Check**:
   - [x] Verify `.env` has all `SPEAKASAP_DB_*` variables (values may be empty for now)
   - [x] Verify `.env.example` has variable names documented
   - [x] Verify `LOGGING_SERVICE_URL` or `LOGGING_SERVICE_INTERNAL_URL` is configured for centralized logging
   - [x] Confirm `.env` backup was created before modification (verified - task completed correctly)

3. **Compilation Check**:
   - [x] Database module compiles without errors
   - [x] Verify no TypeScript compilation errors in database.module.ts
   - [x] Check for any import/dependency issues (LoggerService properly imported)

4. **Integration Check**:
   - [x] Verify DataSource can be injected: `@Inject('SPEAKASAP_DATA_SOURCE') private speakasapDataSource: DataSource`
   - [x] Check that TypeORM DataSource type is imported correctly
   - [x] Verify InnerService and InvoiceService successfully inject SPEAKASAP_DATA_SOURCE

## Notes

- This is a foundational task - Inner and Invoice providers depend on this connection
- Database credentials should be retrieved from production or staging environment
- Use parameterized queries (`$1`, `$2`, etc.) for SQL injection prevention
- Connection should handle errors gracefully and log connection failures

### Shared External Database Server

**Important**: This service uses the **shared external database server** (`database-server`) for the speakasap-portal database connection. The database server is a centralized PostgreSQL instance that hosts multiple project databases.

**Connection Details**:

- **Hostname**: `db-server-postgres` (on Docker network `nginx-network`)
- **Port**: Configured in `database-server/.env` as `DB_SERVER_PORT` (default: `5432`)
- **Network**: Both services must be on the same Docker network (`nginx-network`)

**To find connection configuration**:

1. Check `database-server/README.md` for complete connection documentation and architecture details
2. Use command `cat database-server/.env` to see current port configuration and connection settings
3. Connection string format: `postgresql://username:password@db-server-postgres:${DB_SERVER_PORT:-5432}/database_name`

**Environment Variables** (for speakasap-portal database on shared server):

```env
SPEAKASAP_DB_HOST=db-server-postgres  # Docker network hostname
SPEAKASAP_DB_PORT=5432  # Port from database-server/.env (DB_SERVER_PORT)
SPEAKASAP_DB_USER=<speakasap_db_user>  # Database user for speakasap-portal database
SPEAKASAP_DB_PASSWORD=<speakasap_db_password>  # Database password
SPEAKASAP_DB_NAME=<speakasap_database_name>  # Database name (e.g., 'speakasap_portal')
```

**Reference**: See `database-server/README.md` for:

- Complete connection documentation
- Port configuration details
- Docker network requirements
- Connection examples
- Troubleshooting guide

### Centralized Logging Configuration

**Important**: This service uses the external shared **logging-microservice** for centralized logging. You must configure the logging service connection in `.env`:

**For services on the same Docker network** (recommended):

```env
LOGGING_SERVICE_URL=http://logging-microservice:3367
# OR
LOGGING_SERVICE_INTERNAL_URL=http://logging-microservice:3367
```

**For services outside Docker network**:

```env
LOGGING_SERVICE_URL=https://logging.statex.cz
```

**Configuration Details**:

- Default port: `3367` (configured in `logging-microservice/.env`)
- Service name: `logging-microservice` (configured in `logging-microservice/.env`)
- API endpoint: `/api/logs` (default, can be overridden with `LOGGING_SERVICE_API_PATH`)
- Network: Services must be on the same Docker network (`nginx-network` by default)

**To find the exact configuration**:

1. Check `logging-microservice/.env` for `SERVICE_NAME`, `PORT`, and `DOMAIN` values
2. See `logging-microservice/README.md` for detailed integration guide and connection examples
3. The LoggerService automatically uses `LOGGING_SERVICE_URL` or `LOGGING_SERVICE_INTERNAL_URL` from environment variables

**Reference**: See `logging-microservice/README.md` for complete integration guide, API documentation, and connection examples.

## Improvements Made

1. **Centralized Logging**: Replaced `console.log` and `console.error` with `LoggerService` for centralized logging (per user rules). LoggerService integrates with the external shared **logging-microservice** and is injected into the factory function with fallback to console if not available during initialization.

2. **Import Order**: Reordered imports in `app.module.ts` to ensure `LoggerModule` is imported before `DatabaseModule` so LoggerService is available during database initialization.

3. **Error Handling**: Enhanced error handling with proper logging using LoggerService, maintaining fallback to console for critical initialization errors.

4. **Code Quality**: Removed unused `OnModuleInit` import from database.module.ts.

5. **Logging Service Configuration**: Documented requirement to configure `LOGGING_SERVICE_URL` or `LOGGING_SERVICE_INTERNAL_URL` to connect to the external shared logging-microservice. See `logging-microservice/README.md` for connection details and integration guide.

## Verification Status

✅ **TASK-01 Verified and Completed**: All acceptance criteria have been met. The implementation is correct and follows best practices:

- Database connection is properly configured with all required environment variables
- LoggerService is correctly integrated with fallback mechanism
- Code compiles without errors
- DataSource is successfully injected in dependent services (InnerService, InvoiceService)
- Environment variables are properly documented in `.env.example` with detailed connection information
- No trailing spaces or code quality issues
- Proper error handling and logging throughout

**Improvements Made**:

- Enhanced `.env.example` documentation with database server connection details (hostname `db-server-postgres`, Docker network requirements, port configuration reference)

**Note**: Connection lifecycle management is handled automatically by NestJS and TypeORM, so explicit cleanup is not required. The implementation is production-ready.

## Related Tasks

- TASK-03: Fix Inner Payment Provider (depends on this)
- TASK-04: Complete Invoice Payment Provider (depends on this)
