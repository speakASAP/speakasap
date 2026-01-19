# TASK-05: Complete Webhook Handling and Add Callback Mechanism

## Status
- **Phase**: Phase 1 - payments-microservice infrastructure
- **Priority**: Critical (required for payment completion flow)
- **Dependencies**: TASK-02 (WebPay signature verification), TASK-03 (Inner completion)
- **Estimated Time**: 2-3 hours

## Objective
Complete webhook handling for WebPay and implement callback mechanism to notify speakasap-portal when payments complete.

## Prerequisites
- TASK-02 completed (WebPay signature verification)
- TASK-03 completed (Inner payment completion)
- Webhooks service exists: `payments-microservice/src/webhooks/webhooks.service.ts`
- Webhooks controller exists: `payments-microservice/src/webhooks/webhooks.controller.ts`

## Implementation Steps

### 1. Complete WebPay Webhook Handler
**File**: `payments-microservice/src/webhooks/webhooks.service.ts`

- Update `handleWebPayWebhook` method:
  - Process callback data from WebPay gateway (form data or query params)
  - Extract fields: `OPERATION`, `ORDERNUMBER`, `MERORDERNUM`, `MD`, `PRCODE`, `SRCODE`, `RESULTTEXT`, `DIGEST`, `DIGEST1`
  - Verify signature using `WebPayService.verifyWebhookSignature(data)`
  - Find payment by `providerTransactionId` (ORDERNUMBER or MERORDERNUM)
  - Determine status: COMPLETED if PRCODE=0, FAILED otherwise
  - Update payment status via `PaymentsService.updatePaymentStatus()`
  - Call speakasap-portal callback URL with payment status
  - Handle errors and log them

### 2. Implement Callback Mechanism to speakasap-portal
**File**: `payments-microservice/src/webhooks/webhooks.service.ts`

- Inject `HttpService` and `ConfigService` in constructor
- Add properties:
  - `callbackUrl`: from `SPEAKASAP_PORTAL_CALLBACK_URL` env var
  - `callbackApiKey`: from `SPEAKASAP_PORTAL_API_KEY` env var
- Implement `callbackToSpeakasapPortal(payment: Payment, event: string): Promise<void>` method:
  - Build callback URL: `{callbackUrl}/api/payments/webhook` or use `payment.callbackUrl`
  - Create payload:
    ```json
    {
      "paymentId": "uuid",
      "orderId": "string",
      "status": "completed|failed",
      "paymentMethod": "webpay|inner|invoice|paypal",
      "event": "completed|failed",
      "timestamp": "ISO8601",
      "metadata": {}
    }
    ```
  - Send POST request with `X-API-Key` header
  - Implement retry logic: max 3 retries with exponential backoff (1s, 2s, 4s)
  - Retry on network errors and HTTP 5xx errors
  - Do NOT retry on HTTP 4xx errors
  - Log all callback attempts and failures

### 3. Handle Inner Payment Completion
**File**: `payments-microservice/src/webhooks/webhooks.service.ts`

- Implement `handleInnerPaymentCompletion(paymentId: string): Promise<void>` method:
  - Get payment from PaymentsService
  - Call `InnerService.completePayment(paymentId, orderId)`
  - Then call `callbackToSpeakasapPortal(payment, 'completed')`
  - Handle errors

### 4. Update PaymentsService Integration
**File**: `payments-microservice/src/payments/payments.service.ts`

- Update `updatePaymentStatus` method:
  - When Inner payment status changes to COMPLETED, trigger completion logic
  - Call webhook service's `handleInnerPaymentCompletion` or call `InnerService.completePayment` directly
  - Then call `notifyApplication` to send callback
- Ensure `notifyApplication` calls webhook service's callback method

### 5. Update Webhooks Module
**File**: `payments-microservice/src/webhooks/webhooks.module.ts`

- Add `HttpModule` to imports (for HttpService)
- Ensure all dependencies are provided

### 6. Update Webhooks Controller
**File**: `payments-microservice/src/webhooks/webhooks.controller.ts`

- Ensure WebPay endpoint processes webhook correctly
- Verify endpoint accepts POST requests
- Handle form data and query params

### 7. Add Extensive Logging
**File**: `payments-microservice/src/webhooks/webhooks.service.ts`

- Use NestJS Logger or centralized logger (`utils/logger.js` if available)
- Log all webhook processing attempts with context (paymentId, orderId, provider)
- Log signature verification results (success/failure)
- Log payment status updates
- Log all callback attempts (success and failures)
- Log retry attempts with attempt number and delay
- Log callback failures with error details
- Use centralized logging service if available: `LOGGING_SERVICE_URL=http://logging-microservice:3367`
- Log levels: `error` for failures, `warn` for retries, `info` for operations, `debug` for detailed flow
- Never log sensitive data (API keys, payment details in full)

### 8. Add Timeout Handling
**File**: `payments-microservice/src/webhooks/webhooks.service.ts`

- Configure timeout for callback requests (recommended: 30 seconds)
- Handle timeout errors gracefully
- Retry on timeout (as part of retry logic)
- Log timeout occurrences
- Consider request size limits (max 30 items per request per user rules)

## Files to Modify

1. `payments-microservice/src/webhooks/webhooks.service.ts`
2. `payments-microservice/src/payments/payments.service.ts`
3. `payments-microservice/src/webhooks/webhooks.module.ts`
4. `payments-microservice/src/webhooks/webhooks.controller.ts` (if needed)

## Callback Payload Structure

```json
{
  "paymentId": "uuid-from-microservice",
  "orderId": "order-id-from-speakasap-portal",
  "status": "completed|failed",
  "paymentMethod": "webpay|inner|invoice|paypal",
  "event": "completed|failed",
  "timestamp": "2025-01-01T12:00:00Z",
  "metadata": {
    "providerTransactionId": "webpay-order-number",
    "additionalInfo": {}
  }
}
```

## Retry Logic

- Max 3 retries
- Exponential backoff: 1s, 2s, 4s
- Retry conditions:
  - Network errors (timeout, connection refused)
  - HTTP 5xx errors (server errors)
- Do NOT retry:
  - HTTP 4xx errors (client errors)
- Log each retry attempt
- After 3 failures, log error and mark callback as failed

## Acceptance Criteria

- [x] WebPay webhook handler processes callback correctly
- [x] Signature verification works (uses WebPayService)
- [x] Payment status is updated correctly
- [x] Callback mechanism sends POST requests to speakasap-portal
- [x] Retry logic works correctly (max 3 retries, exponential backoff)
- [x] Inner payment completion calls `completePayment` correctly
- [x] Callback payload includes all required fields
- [x] Error handling works correctly
- [x] All callback attempts are logged
- [x] HttpModule is imported in WebhooksModule
- [x] Code compiles without errors
- [x] Extensive logging is implemented for all operations
- [x] Timeout handling is configured and works (30 seconds)
- [x] No hardcoded values (use environment variables)
- [x] No trailing spaces in code

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [x] Verify WebPay webhook handler processes callback data
   - [x] Check signature verification is called
   - [x] Verify payment status update logic
   - [x] Confirm callback method sends POST requests
   - [x] Check retry logic implementation
   - [x] Verify Inner payment completion flow
   - [x] Check callback payload structure
   - [x] Confirm HttpModule is imported

2. **Integration Check**:
   - [x] Verify WebPayService.verifyWebhookSignature is called
   - [x] Check PaymentsService.updatePaymentStatus integration
   - [x] Verify InnerService.completePayment is called for Inner payments
   - [x] Confirm callback URL is built correctly
   - [x] Verify PaymentsService.notifyApplication uses WebhooksService.callbackToSpeakasapPortal

3. **Retry Logic Check**:
   - [x] Verify max 3 retries
   - [x] Check exponential backoff (1s, 2s, 4s)
   - [x] Confirm retry conditions (network errors, 5xx)
   - [x] Verify no retry on 4xx errors
   - [x] Check retry logging

4. **Error Handling Check**:
   - [x] Verify callback errors are handled
   - [x] Check database errors are handled
   - [x] Confirm errors are logged properly

5. **Compilation Check**:
   - [x] Run `npm run build` in payments-microservice directory
   - [x] Verify no TypeScript compilation errors
   - [x] Check for any missing imports or dependencies

6. **Logging Check**:
   - [x] Verify logging is implemented for webhook processing
   - [x] Check callback attempts are logged
   - [x] Verify retry attempts are logged
   - [x] Confirm errors are logged with context
   - [x] Check centralized logging service is used (if available)

7. **Timeout Check**:
   - [x] Verify timeout is configured for callback requests (30 seconds)
   - [x] Check timeout errors are handled
   - [x] Confirm timeout triggers retry logic
   - [x] Verify timeout is logged

8. **Code Quality Check**:
   - [x] Verify no hardcoded values
   - [x] Check no trailing spaces
   - [x] Confirm code follows best practices

## Notes

- Callback URL can be from payment record or environment variable
- Retry logic is critical for reliability
- Log all callback attempts for debugging
- Handle webhook idempotency (avoid duplicate processing)
- Webhook signature verification prevents unauthorized callbacks
- Use extensive logging for debugging webhook and callback issues
- Configure appropriate timeouts (recommended: 30 seconds for callbacks)
- Handle timeout errors gracefully with retry logic
- Never log sensitive data (API keys, full payment details)
- Check existing codebase before adding new code (per user rules)

## Verification Status

✅ **TASK-05 Verified and Completed**: All acceptance criteria have been met. The implementation is correct and follows best practices:

- ✅ WebPay webhook handler processes callback correctly with extensive logging
- ✅ Signature verification works using WebPayService.verifyWebhookSignature
- ✅ Payment status is updated correctly via PaymentsService.updatePaymentStatus
- ✅ Callback mechanism sends POST requests to speakasap-portal with retry logic
- ✅ Retry logic works correctly (max 3 retries, exponential backoff: 1s, 2s, 4s)
- ✅ Retry logic correctly handles HTTP status codes (retries on 5xx and network errors, does NOT retry on 4xx)
- ✅ Inner payment completion calls `completePayment` correctly and then sends callback
- ✅ Callback payload includes all required fields including providerTransactionId in metadata
- ✅ Error handling works correctly with comprehensive logging
- ✅ All callback attempts are logged with context (paymentId, orderId, attempt number)
- ✅ HttpModule is imported in WebhooksModule
- ✅ Code compiles without errors
- ✅ Extensive logging implemented for all operations (webhook processing, signature verification, payment status updates, callback attempts, retries)
- ✅ Timeout handling is configured (30 seconds) and works correctly
- ✅ No hardcoded values (all use environment variables)
- ✅ No trailing spaces in code

**Improvements Made**:
- **Callback Integration**: Updated PaymentsService.notifyApplication to use WebhooksService.callbackToSpeakasapPortal for enhanced retry logic and error handling
- **Timeout Configuration**: Increased callback timeout from 5 seconds to 30 seconds as per requirements
- **Retry Logic Enhancement**: Added HTTP status code checking - retries on network errors and HTTP 5xx errors, does NOT retry on HTTP 4xx errors
- **Inner Payment Completion**: Added callbackToSpeakasapPortal call after Inner payment completion
- **Enhanced Logging**: Added extensive logging throughout webhook processing with context (paymentId, orderId, orderNumber, PRCODE, SRCODE, attempt numbers, error details)
- **Callback Payload**: Added providerTransactionId to metadata in callback payload
- **Module Integration**: Used forwardRef to handle circular dependency between PaymentsModule and WebhooksModule
- **WebPay Webhook Logging**: Added detailed logging for signature verification, callback processing, and payment status updates
- **Callback URL Validation**: Enhanced callback URL validation to properly handle empty SPEAKASAP_PORTAL_CALLBACK_URL environment variable and ensure valid absolute URLs are used (prevents invalid relative URLs like `/api/payments/webhook`). Validates that callback URLs start with `http://` or `https://` before making requests.

**Payment Flow**:
1. WebPay gateway sends callback to `/webhooks/webpay` endpoint
2. WebhooksService.handleWebPayWebhook processes callback:
   - Verifies signature using WebPayService.verifyWebhookSignature
   - Processes callback using WebPayService.processCallback
   - Finds payment by providerTransactionId (ORDERNUMBER or MERORDERNUM)
   - Updates payment status via PaymentsService.updatePaymentStatus
3. PaymentsService.updatePaymentStatus:
   - Updates payment status in database
   - For Inner payments, calls InnerService.completePayment
   - Calls notifyApplication which uses WebhooksService.callbackToSpeakasapPortal
4. WebhooksService.callbackToSpeakasapPortal:
   - Sends POST request to speakasap-portal callback URL
   - Implements retry logic (max 3 retries, exponential backoff)
   - Retries on network errors and HTTP 5xx errors
   - Does NOT retry on HTTP 4xx errors
   - Logs all attempts and failures

**Note**: The implementation correctly handles webhook processing, payment status updates, and callback notifications. The code is production-ready and integrates properly with all payment providers. All logging is automatically sent to the centralized logging-microservice when configured.

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

## Related Tasks
- TASK-02: Enhance WebPay Provider (provides signature verification) ✅
- TASK-03: Fix Inner Payment Provider (provides completePayment) ✅
- TASK-14: Add Webhook Endpoint in speakasap-portal (receives callbacks)
