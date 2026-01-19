# TASK-03: Fix Inner Payment Provider - Database Connection and Transaction Logic

## Status
- **Phase**: Phase 1 - payments-microservice infrastructure
- **Priority**: High
- **Dependencies**: TASK-01 (Database Connection)
- **Estimated Time**: 1-2 hours

## Objective
Fix Inner payment provider to use speakasap-portal database connection and implement correct balance checking and transaction creation logic.

## Prerequisites
- TASK-01 completed (SPEAKASAP_DATA_SOURCE available)
- Inner service file exists: `payments-microservice/src/payments/providers/inner/inner.service.ts`
- Database connection configured and working

## Implementation Steps

### 1. Inject Database Connection
**File**: `payments-microservice/src/payments/providers/inner/inner.service.ts`

- Inject `SPEAKASAP_DATA_SOURCE` in constructor: `@Inject('SPEAKASAP_DATA_SOURCE') private speakasapDataSource: DataSource`
- Import `DataSource` from `typeorm`
- Remove any existing incorrect database access code

### 2. Fix Balance Checking Logic
**File**: `payments-microservice/src/payments/providers/inner/inner.service.ts`

- Implement `getUserBalance(userId: number): Promise<number>` method
- Query: `SELECT COALESCE(SUM(amount), 0) as balance FROM orders_transaction WHERE user_id = $1`
- Use parameterized query: `this.speakasapDataSource.query(sql, [userId])`
- Return balance as number
- Handle database errors gracefully

### 3. Fix Payment Creation Logic
**File**: `payments-microservice/src/payments/providers/inner/inner.service.ts`

- Update `createPayment` method:
  - Extract `userId` from metadata or request
  - Call `getUserBalance(userId)` to check balance
  - Validate balance >= payment amount
  - Throw error if insufficient balance (error code: `INSUFFICIENT_BALANCE`)
  - Do NOT create transaction at this stage (only validate)
  - Return payment object with status `PENDING`

### 4. Implement Payment Completion Logic
**File**: `payments-microservice/src/payments/providers/inner/inner.service.ts`

- Implement `completePayment(paymentId: string, orderId: string): Promise<void>` method
- Create negative transaction to deduct balance:
  ```sql
  INSERT INTO orders_transaction (user_id, amount, comment, order_id, is_income, external, created)
  VALUES ($1, -$2, $3, $4, false, false, NOW())
  ```
- Extract `userId` from payment metadata
- Comment format: `Оплата заказа {orderId}` or similar
- `is_income` = false (negative amount for payment)
- `external` = false for inner payments
- Handle database errors and log them

### 5. Implement Refund Logic
**File**: `payments-microservice/src/payments/providers/inner/inner.service.ts`

- Update `refundPayment` method:
  - Create positive transaction to refund balance:
    ```sql
    INSERT INTO orders_transaction (user_id, amount, comment, order_id, is_income, external, created)
    VALUES ($1, $2, $3, $4, true, false, NOW())
    ```
  - Extract `userId` from payment metadata
  - Comment format: `Возврат средств: {reason}` or similar
  - `is_income` = true (positive amount for refund)
  - `external` = false for inner payments
  - Handle database errors

### 6. Add Extensive Logging
**File**: `payments-microservice/src/payments/providers/inner/inner.service.ts`

- Use centralized LoggerService (from `shared/logger/logger.service.ts`) which integrates with external shared logging-microservice
- Log all balance checking operations (userId, balance result) - without exposing full transaction details
- Log payment creation attempts with context (userId, amount, orderId, balance validation result)
- Log payment completion operations (paymentId, userId, amount, transaction creation)
- Log refund operations (paymentId, userId, refund amount, reason)
- Log database query operations (without exposing full query parameters)
- Log errors with full context (userId, paymentId, orderId, error details, stack trace)
- **Configure logging-microservice connection**: Ensure `LOGGING_SERVICE_URL` or `LOGGING_SERVICE_INTERNAL_URL` is set in `.env` (see logging-microservice README.md for connection details)
- Log levels: `error` for failures, `warn` for warnings, `info` for operations, `debug` for detailed flow
- LoggerService automatically sends logs to centralized logging-microservice with fallback to local file logging
- Never log sensitive data (full payment details, customer data)

### 6. Update Payment Flow Integration
**File**: `payments-microservice/src/payments/payments.service.ts`

- Ensure `completePayment` is called when Inner payment status changes to COMPLETED
- This may be handled in webhook service (TASK-05)

## Files to Modify

1. `payments-microservice/src/payments/providers/inner/inner.service.ts`
2. `payments-microservice/src/payments/payments.service.ts` (if needed for completion flow)

## Database Schema Reference

**Table**: `orders_transaction`
- Fields: `id`, `user_id`, `amount`, `comment`, `order_id`, `is_income`, `external`, `created`
- Balance calculation: `SUM(amount) WHERE user_id = ?`
- Transaction creation: Negative amount for payment, positive for refund
- `is_income` = true if amount > 0, false if amount < 0
- `external` = false for inner payments

## Acceptance Criteria

- [x] `SPEAKASAP_DATA_SOURCE` is injected correctly in InnerService
- [x] `getUserBalance` method queries database correctly
- [x] Balance checking validates balance before payment creation
- [x] Payment creation does NOT create transaction (only validates)
- [x] `completePayment` creates negative transaction correctly
- [x] `refundPayment` creates positive transaction correctly
- [x] All SQL queries use parameterized queries ($1, $2, etc.)
- [x] Error handling for insufficient balance works
- [x] Error handling for database errors works
- [x] Code compiles without errors
- [x] Extensive logging implemented for all operations (balance checks, payment creation, completion, refunds)
- [x] Enhanced error handling with meaningful error messages

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [x] Verify `SPEAKASAP_DATA_SOURCE` injection in constructor (line 23)
   - [x] Check `getUserBalance` uses correct SQL query (parameterized query with $1)
   - [x] Verify balance validation in `createPayment` (balance check before payment creation)
   - [x] Confirm `createPayment` does NOT create transaction (only validates balance)
   - [x] Check `completePayment` creates negative transaction (negative amount, is_income=false)
   - [x] Verify `refundPayment` creates positive transaction (positive amount, is_income=true)
   - [x] Confirm all queries use parameterized queries ($1, $2, etc.)

2. **Logic Check**:
   - [x] Verify payment creation only validates balance (no transaction created)
   - [x] Check transaction is created only on completion (completePayment method)
   - [x] Verify transaction amounts are correct (negative for payment, positive for refund)
   - [x] Confirm `is_income` and `external` flags are set correctly (is_income=false for payment, true for refund; external=false)

3. **Error Handling Check**:
   - [x] Verify insufficient balance error is thrown correctly (with available/required amounts)
   - [x] Check database error handling (try-catch blocks with logging)
   - [x] Confirm errors are logged properly (all errors logged with context)

4. **Compilation Check**:
   - [x] Run `npm run build` in payments-microservice directory (no TypeScript errors in inner.service.ts)
   - [x] Verify no TypeScript compilation errors (all types correct)
   - [x] Check for any missing imports or dependencies (all imports present)

5. **Integration Check**:
   - [x] Verify `completePayment` is called when payment completes (PaymentsService.updatePaymentStatus calls it for Inner payments)
   - [x] Check payment flow integration with PaymentsService (completePayment integrated in updatePaymentStatus)

## Notes

- Transaction creation happens ONLY on payment completion, not on creation
- Balance validation happens on creation to prevent invalid payments
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

✅ **TASK-03 Verified and Completed**: All acceptance criteria have been met. The implementation is correct and follows best practices:

- ✅ `SPEAKASAP_DATA_SOURCE` is correctly injected in InnerService constructor
- ✅ `getUserBalance` method queries database correctly using parameterized queries
- ✅ Balance checking validates balance before payment creation
- ✅ Payment creation does NOT create transaction (only validates balance)
- ✅ `completePayment` creates negative transaction correctly (deducts balance)
- ✅ `refundPayment` creates positive transaction correctly (refunds balance)
- ✅ All SQL queries use parameterized queries ($1, $2, etc.) for SQL injection prevention
- ✅ Error handling for insufficient balance works (throws error with available/required amounts)
- ✅ Error handling for database errors works (try-catch blocks with logging)
- ✅ Code compiles without errors (no TypeScript or linter errors)
- ✅ Extensive logging implemented for all operations (balance checks, payment creation, completion, refunds)
- ✅ Enhanced error handling with meaningful error messages and context

**Improvements Made**:
- **Fixed RefundPaymentRequest**: Added optional `metadata` property to `RefundPaymentRequest` interface to support passing userId for Inner payment refunds
- **Updated PaymentsService**: Modified `refundPayment` to pass payment metadata to provider refund requests
- **Enhanced Error Handling**: Added validation for all parameters, improved error messages with context
- **Enhanced Logging**: Added extensive logging throughout all methods with context (userId, amount, orderId, paymentId) using centralized LoggerService
- **Balance Verification**: Added double-check balance verification in `completePayment` before creating transaction
- **Code Quality**: Fixed trailing spaces, improved code comments and documentation
- **Code Cleanup**: Removed unused `createTransaction` helper method (direct queries are more explicit and match requirements exactly)
- **Logging Service Integration**: Uses centralized LoggerService which automatically integrates with external shared logging-microservice (configured via `LOGGING_SERVICE_URL` environment variable)

**Payment Flow Integration**:
- `completePayment` is called from `PaymentsService.updatePaymentStatus` when Inner payment status changes to COMPLETED (line 193-216)
- Payment metadata (including userId) is stored in Payment entity and passed to refund requests
- All database operations use parameterized queries for security

**Note**: The implementation correctly handles Inner payment flow: balance validation on creation, transaction creation on completion, and refunds. The code is production-ready and integrates properly with PaymentsService. All logging is automatically sent to the centralized logging-microservice when configured.

## Related Tasks
- TASK-01: Configure Database Connection (prerequisite) ✅
- TASK-05: Complete Webhook Handling (calls completePayment for Inner payments)
