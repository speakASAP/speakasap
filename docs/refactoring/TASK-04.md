# TASK-04: Complete Invoice Payment Provider - Invoice Number Generation and Database Operations

## Status
- **Phase**: Phase 1 - payments-microservice infrastructure
- **Priority**: High
- **Dependencies**: TASK-01 (Database Connection)
- **Estimated Time**: 1-2 hours

## Objective
Complete Invoice payment provider by implementing invoice number generation and database record creation in speakasap-portal database.

## Prerequisites
- TASK-01 completed (SPEAKASAP_DATA_SOURCE available)
- Invoice service file exists: `payments-microservice/src/payments/providers/invoice/invoice.service.ts`
- Database connection configured and working

## Implementation Steps

### 1. Inject Database Connection
**File**: `payments-microservice/src/payments/providers/invoice/invoice.service.ts`

- Inject `SPEAKASAP_DATA_SOURCE` in constructor: `@Inject('SPEAKASAP_DATA_SOURCE') private speakasapDataSource: DataSource`
- Import `DataSource` from `typeorm`
- Remove any existing incorrect database access code

### 2. Implement Invoice Number Generation
**File**: `payments-microservice/src/payments/providers/invoice/invoice.service.ts`

- Implement `generateInvoiceNumber(): Promise<number>` method
- Format: YYMMDDNN (e.g., 25010101 for Jan 1, 2025, invoice 01)
- Algorithm:
  1. Get current date
  2. Calculate `minNumber = parseInt(YYMMDD00, 10)` (e.g., 25010100)
  3. Calculate `maxNumber = parseInt(YYMMDD99, 10)` (e.g., 25010199)
  4. Query: `SELECT number FROM orders_invoicepayment WHERE number > $1 AND number < $2 ORDER BY number DESC LIMIT 1`
  5. If result exists: `return result.number + 1`
  6. If no result: `return minNumber + 1`
- Handle edge cases:
  - First invoice of day: Returns minNumber + 1
  - Date rollover: Uses next day's range for maxNumber
  - Concurrent requests: Database unique constraint handles conflicts
- Use parameterized queries

### 3. Implement Invoice Payment Record Creation
**File**: `payments-microservice/src/payments/providers/invoice/invoice.service.ts`

- Update `createPayment` method:
  - Call `generateInvoiceNumber()` to get invoice number
  - Insert into `orders_invoicepayment` table:
    ```sql
    INSERT INTO orders_invoicepayment (number, amount, ruble, received, actual_amount, paid, order_id, created)
    VALUES ($1, $2, 0, false, 0, NULL, $3, NOW())
    ```
  - Set initial status:
    - `received = false`
    - `paid = NULL`
    - `actual_amount = 0`
    - `ruble = 0`
  - Store invoice number in `providerTransactionId` field
  - Extract `orderId` from request metadata
  - Handle database errors gracefully
  - Return payment object with invoice number

### 4. Implement Payment Status Checking
**File**: `payments-microservice/src/payments/providers/invoice/invoice.service.ts`

- Update `getPaymentStatus` method:
  - Query by invoice number: `SELECT id, number, amount, paid, received, actual_amount, ruble FROM orders_invoicepayment WHERE number = $1 LIMIT 1`
  - Return status based on record:
    - `PENDING`: `received = false` and `paid = NULL`
    - `PROCESSING`: `received = true` and `paid = NULL`
    - `COMPLETED`: `paid = true`
  - Handle missing records (return `PENDING` or throw error)

### 5. Implement Payment Confirmation
**File**: `payments-microservice/src/payments/providers/invoice/invoice.service.ts`

- Implement `confirmPayment(invoiceNumber: number, actualAmount?: number): Promise<void>` method
- Update invoice record:
  ```sql
  UPDATE orders_invoicepayment
  SET received = true, actual_amount = COALESCE($1, amount)
  WHERE number = $2
  ```
- When payment fully processed, update `paid = true`:
  ```sql
  UPDATE orders_invoicepayment
  SET paid = true
  WHERE number = $1
  ```
- Handle database errors

### 6. Add Extensive Logging
**File**: `payments-microservice/src/payments/providers/invoice/invoice.service.ts`

- Use centralized LoggerService (from `shared/logger/logger.service.ts`) which integrates with external shared logging-microservice
- Log all invoice number generation attempts with context (date, minNumber, maxNumber, generated number)
- Log invoice record creation (invoice number, amount, orderId) - without sensitive data
- Log payment status checks (invoice number, current status)
- Log payment confirmation operations (invoice number, actualAmount, status changes)
- Log database query operations (without exposing full query parameters)
- Log errors with full context (invoice number, orderId, error details, stack trace)
- **Configure logging-microservice connection**: Ensure `LOGGING_SERVICE_URL` or `LOGGING_SERVICE_INTERNAL_URL` is set in `.env` (see logging-microservice README.md for connection details)
- Log levels: `error` for failures, `warn` for warnings, `info` for operations, `debug` for detailed flow
- LoggerService automatically sends logs to centralized logging-microservice with fallback to local file logging
- Never log sensitive data (full payment details, customer data)

## Files to Modify

1. `payments-microservice/src/payments/providers/invoice/invoice.service.ts`

## Database Schema Reference

**Table**: `orders_invoicepayment`
- Fields: `id`, `number` (unique), `amount`, `ruble`, `scan`, `received`, `actual_amount`, `paid`, `order_id`, `created`
- Invoice number format: YYMMDDNN (sequential per day)
- Initial status: `received = false`, `paid = NULL`
- `order_id` references `orders_order` table

## Acceptance Criteria

- [x] `SPEAKASAP_DATA_SOURCE` is injected correctly in InvoiceService
- [x] `generateInvoiceNumber` generates correct format (YYMMDDNN)
- [x] Invoice number generation handles edge cases (first invoice, date rollover, concurrent requests)
- [x] `createPayment` creates invoice record in database
- [x] Invoice record has correct initial status values (received=false, paid=NULL, actual_amount=0, ruble=0)
- [x] Invoice number is stored in `providerTransactionId`
- [x] `getPaymentStatus` queries database correctly
- [x] Status mapping is correct (PENDING, PROCESSING, COMPLETED)
- [x] `confirmPayment` updates invoice record correctly (received=true, actual_amount)
- [x] `markAsPaid` method implemented to update paid=true
- [x] All SQL queries use parameterized queries ($1, $2, etc.)
- [x] Error handling works correctly (try-catch blocks with logging)
- [x] Code compiles without errors (no TypeScript or linter errors)
- [x] Extensive logging implemented for all operations (invoice generation, record creation, status checks, confirmation)
- [x] Logging uses centralized LoggerService with logging-microservice integration

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [x] Verify `SPEAKASAP_DATA_SOURCE` injection in constructor (line 23)
   - [x] Check `generateInvoiceNumber` algorithm is correct (handles date rollover with tomorrow's date)
   - [x] Verify invoice number format (YYMMDDNN) - correct format implemented
   - [x] Confirm `createPayment` inserts record correctly (all required fields included)
   - [x] Check initial status values are set correctly (received=false, paid=NULL, actual_amount=0, ruble=0)
   - [x] Verify `getPaymentStatus` queries database (parameterized query with $1)
   - [x] Confirm `confirmPayment` updates record correctly (received=true, actual_amount)
   - [x] Verify `markAsPaid` method exists and updates paid=true correctly
   - [x] Check all queries use parameterized queries ($1, $2, etc.)

2. **Logic Check**:
   - [x] Test invoice number generation for first invoice of day (returns minNumber + 1)
   - [x] Test invoice number generation for subsequent invoices (increments from last number)
   - [x] Verify invoice number increments correctly (result[0].number + 1)
   - [x] Check date rollover handling (uses tomorrow's date for maxNumber)
   - [x] Verify status mapping logic (PENDING: not received, PROCESSING: received but not paid, COMPLETED: paid)

3. **Database Check**:
   - [x] Verify INSERT query includes all required fields (number, amount, ruble, received, actual_amount, paid, order_id, created)
   - [x] Check initial values are correct (received=false, paid=NULL, actual_amount=0, ruble=0)
   - [x] Confirm UPDATE queries work correctly (confirmPayment and markAsPaid)
   - [x] Verify invoice number uniqueness constraint (handled by database, fallback on error)

4. **Error Handling Check**:
   - [x] Verify database error handling (try-catch blocks with logging)
   - [x] Check missing record handling (returns PENDING status if invoice not found)
   - [x] Confirm errors are logged properly (all errors logged with context)
   - [x] Verify input validation (amount, orderId, userId, invoiceNumber)

5. **Compilation Check**:
   - [x] Run `npm run build` in payments-microservice directory (no errors in invoice.service.ts)
   - [x] Verify no TypeScript compilation errors (all types correct)
   - [x] Check for any missing imports or dependencies (all imports present)

## Notes

- Invoice numbers are sequential per day (format: YYMMDDNN)
- Database unique constraint handles concurrent invoice creation
- Invoice confirmation can be done manually or via API endpoint
- Use parameterized queries to prevent SQL injection
- Handle database connection errors gracefully
- Log all database operations for debugging

### Centralized Logging Configuration

**Important**: This service uses the external shared **logging-microservice** for centralized logging. The LoggerService automatically integrates with the logging-microservice when configured.

**Configuration** (in `payments-microservice/.env`):

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
- Network: Both services must be on the same Docker network (`nginx-network`)

**To find the exact configuration**:
1. Check `logging-microservice/.env` for `SERVICE_NAME`, `PORT`, and `DOMAIN` values
2. See `logging-microservice/README.md` for detailed integration guide and connection examples
3. The LoggerService automatically uses `LOGGING_SERVICE_URL` or `LOGGING_SERVICE_INTERNAL_URL` from environment variables

**Reference**: See `logging-microservice/README.md` for complete integration guide, API documentation, and connection examples.

## Verification Status

✅ **TASK-04 Verified and Completed**: All acceptance criteria have been met. The implementation is correct and follows best practices:

- ✅ `SPEAKASAP_DATA_SOURCE` is correctly injected in InvoiceService constructor
- ✅ `generateInvoiceNumber` generates correct format (YYMMDDNN) with proper date handling
- ✅ Invoice number generation handles edge cases (first invoice of day, date rollover using tomorrow's date, concurrent requests via database constraint)
- ✅ `createPayment` creates invoice record in database with all required fields
- ✅ Invoice record has correct initial status values (received=false, paid=NULL, actual_amount=0, ruble=0)
- ✅ Invoice number is stored in `providerTransactionId` field
- ✅ `getPaymentStatus` queries database correctly using parameterized queries
- ✅ Status mapping is correct (PENDING: not received, PROCESSING: received but not paid, COMPLETED: paid)
- ✅ `confirmPayment` updates invoice record correctly (received=true, actual_amount)
- ✅ `markAsPaid` method implemented to update paid=true when payment fully processed
- ✅ All SQL queries use parameterized queries ($1, $2, etc.) for SQL injection prevention
- ✅ Error handling works correctly (try-catch blocks with comprehensive logging)
- ✅ Code compiles without errors (no TypeScript or linter errors)
- ✅ Extensive logging implemented for all operations (invoice generation with context, record creation, status checks, confirmation)
- ✅ Logging uses centralized LoggerService with logging-microservice integration

**Improvements Made**:
- **Fixed CreatePaymentResponse Interface**: Added optional `metadata` property to `CreatePaymentResponse` interface to support returning invoiceNumber and userId
- **Enhanced Invoice Number Generation**: Added extensive logging with context (date, minNumber, maxNumber, generated number, previous number)
- **Enhanced createPayment**: Added input validation (amount, orderId, userId), improved logging with context
- **Enhanced getPaymentStatus**: Added invoice number validation, improved logging with status details
- **Enhanced confirmPayment**: Added input validation, improved logging, proper amount conversion to cents/grosze
- **Added markAsPaid Method**: Implemented separate method to mark invoice as paid (paid=true) when payment fully processed
- **Enhanced Error Handling**: Added validation for all parameters, improved error messages with context
- **Enhanced Logging**: Added extensive logging throughout all methods with context (invoiceNumber, orderId, userId, amount, status)
- **Code Quality**: Fixed duplicate comments, improved code comments and documentation, removed trailing spaces from SQL queries
- **Amount Conversion**: Amounts are stored in cents/grosze (multiplied by 100) to match speakasap-portal database format, and converted back to decimal when reading (divided by 100)

**Payment Flow**:
- Invoice number is generated sequentially per day (format: YYMMDDNN)
- Invoice record is created in `orders_invoicepayment` table on payment creation
- Invoice status can be checked via `getPaymentStatus` method
- Invoice can be confirmed (received=true) via `confirmPayment` method when bank transfer received
- Invoice can be marked as paid (paid=true) via `markAsPaid` method when payment fully processed
- All database operations use parameterized queries for security

**Note**: The implementation correctly handles invoice payment flow: number generation, record creation, status checking, and confirmation. The code is production-ready and integrates properly with PaymentsService. All logging is automatically sent to the centralized logging-microservice when configured.

## Related Tasks
- TASK-01: Configure Database Connection (prerequisite) ✅
- TASK-05: Complete Webhook Handling (may handle invoice confirmation)
