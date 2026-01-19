# TASK-09: Refactor PaymentFactory to Use payments-microservice

## Status
- **Phase**: Phase 2 - speakasap-portal refactoring
- **Priority**: Critical (core payment creation logic)
- **Dependencies**: TASK-08 (ExternalPayment model)
- **Estimated Time**: 2-3 hours

## Objective
Refactor PaymentFactory to call payments-microservice API for all payment methods instead of creating local payment objects directly.

## Prerequisites
- TASK-08 completed (ExternalPayment model exists)
- PaymentServiceClient exists: `speakasap-portal/orders/payment_service.py` (already completed)
- PaymentFactory exists: `speakasap-portal/orders/utils.py`
- payments-microservice is running and accessible

## Implementation Steps

### 1. Import Required Modules
**File**: `speakasap-portal/orders/utils.py`

- Import PaymentServiceClient: `from orders.payment_service import PaymentServiceClient`
- Import ExternalPayment: `from orders.external_payment.models import ExternalPayment`
- Import settings: `from django.conf import settings`
- Import logging: `import logging`

### 2. Update PaymentFactory.create_payment() Method
**File**: `speakasap-portal/orders/utils.py`

- Initialize PaymentServiceClient instance
- For ALL payment methods (`paypal`, `card`/WebPay, `inner`, `invoice`):
  - Call `PaymentServiceClient.create_payment()` with:
    - `order_id`: order ID
    - `amount`: payment amount
    - `currency`: payment currency
    - `payment_method`: 'paypal', 'webpay', 'inner', or 'invoice'
    - `customer`: customer information (if available)
    - `callback_url`: callback URL for webhooks
    - `metadata`: additional metadata (billing details, userId, etc.)
  - Extract `paymentId` (external_payment_id) from response
  - Extract `redirectUrl` if available
  - Create `ExternalPayment` instance:
    - Set `external_payment_id` = paymentId from microservice
    - Set `provider` = payment_method
    - Set `redirect_url` = redirectUrl from response
    - Set `status` = 'pending'
    - Set other Payment fields (order, amount, currency, etc.)
  - Save ExternalPayment instance
  - Return ExternalPayment object

### 3. Handle Payment-Specific Metadata
**File**: `speakasap-portal/orders/utils.py`

- **WebPay (`card`)**:
  - Include billing details in metadata for ADDINFO XML
  - Extract billing information from request or order
- **Inner**:
  - Include `userId` in metadata
  - Extract user ID from order or request
- **Invoice**:
  - Include `userId` in metadata
  - Extract user ID from order or request
- **PayPal**:
  - Include customer information in metadata
  - Extract customer details from order or request

### 4. Handle Errors
**File**: `speakasap-portal/orders/utils.py`

- Catch `requests.exceptions.RequestException` for network errors
- Parse error responses from payments-microservice
- Handle specific error codes:
  - `INSUFFICIENT_BALANCE` (Inner payment)
  - `PAYMENT_CREATION_FAILED`
  - `INVALID_PAYMENT_METHOD`
- Log errors with context (order ID, payment method, user ID)
- Raise appropriate Django exceptions or return error messages
- Implement retry logic for transient failures (max 3 retries)

### 5. Maintain Backward Compatibility
**File**: `speakasap-portal/orders/utils.py`

- Keep PaymentFactory interface the same
- Return Payment object (ExternalPayment extends Payment)
- Maintain same method signature
- Keep existing error handling patterns

### 6. Update Payment Method Mapping
**File**: `speakasap-portal/orders/utils.py`

- Map payment methods correctly:
  - `card` → `webpay` (for microservice)
  - `inner` → `inner`
  - `invoice` → `invoice`
  - `paypal` → `paypal`
- Ensure all payment methods go through microservice

### 7. Add Extensive Logging
**File**: `speakasap-portal/orders/utils.py`

- Use Django logging system: `import logging; logger = logging.getLogger(__name__)`
- Log all payment creation attempts with context (orderId, paymentMethod, amount, currency)
- Log PaymentServiceClient API calls (request/response without sensitive data)
- Log ExternalPayment creation
- Log errors with full context (order ID, payment method, user ID, error details)
- Use centralized logging service if available: `LOGGING_SERVICE_URL=http://logging-microservice:3367`
- Log levels: `error` for failures, `warn` for warnings, `info` for operations, `debug` for detailed flow
- Never log sensitive data (API keys, full payment details, customer data)

### 8. Add Timeout and Request Size Handling
**File**: `speakasap-portal/orders/payment_service.py` (PaymentServiceClient)

- Configure timeout for API calls (recommended: 30 seconds)
- Handle timeout errors gracefully with retry logic
- Implement request size limits: maximum 30 items per request (per user rules)
- Log timeout occurrences
- Retry on timeout (as part of retry logic in PaymentServiceClient)

## Files to Modify

1. `speakasap-portal/orders/utils.py` (PaymentFactory)

## Payment Creation Flow

1. PaymentFactory.create_payment() called with payment method
2. Build metadata based on payment method
3. Call PaymentServiceClient.create_payment() → payments-microservice API
4. Receive response with paymentId and redirectUrl
5. Create ExternalPayment instance with microservice payment ID
6. Save ExternalPayment to database
7. Return ExternalPayment object

## Acceptance Criteria

- [ ] PaymentFactory calls PaymentServiceClient for all payment methods
- [ ] ExternalPayment instances are created correctly
- [ ] external_payment_id is stored from microservice response
- [ ] redirect_url is stored if available
- [ ] Metadata is built correctly for each payment method
- [ ] Error handling works correctly
- [ ] Retry logic is implemented for transient failures
- [ ] Backward compatibility is maintained
- [ ] Code compiles without errors
- [ ] All payment methods (paypal, webpay, inner, invoice) work
- [ ] Extensive logging is implemented for all operations
- [ ] Timeout handling is configured and works
- [ ] Request size limits are respected (max 30 items)
- [ ] No hardcoded values (use environment variables)
- [ ] No trailing spaces in code

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [ ] Verify PaymentServiceClient is imported and used
   - [ ] Check ExternalPayment is imported and used
   - [ ] Verify all payment methods call microservice
   - [ ] Check metadata building for each payment method
   - [ ] Confirm error handling is implemented
   - [ ] Verify retry logic is implemented

2. **Logic Check**:
   - [ ] Test payment creation for each method
   - [ ] Verify ExternalPayment is created correctly
   - [ ] Check external_payment_id is stored
   - [ ] Verify redirect_url is stored (if available)
   - [ ] Confirm metadata includes required fields

3. **Error Handling Check**:
   - [ ] Verify network errors are handled
   - [ ] Check microservice error responses are parsed
   - [ ] Confirm specific error codes are handled
   - [ ] Verify errors are logged correctly
   - [ ] Check retry logic works

4. **Integration Check**:
   - [ ] Verify PaymentFactory interface is unchanged
   - [ ] Check ExternalPayment extends Payment correctly
   - [ ] Confirm return type is compatible with existing code
   - [ ] Test with existing code that uses PaymentFactory

5. **API Views Compatibility Check**:
   - [ ] Verify `MyOrderMethodView.post()` in `orders/api_views.py` still works
   - [ ] Test payment serializers work with ExternalPayment model
   - [ ] Verify API endpoints maintain backward compatibility
   - [ ] Test API responses include correct payment data
   - [ ] Confirm no changes needed to `api_views.py` (uses PaymentFactory automatically)

6. **Code Quality**:
   - [ ] Run linting checks
   - [ ] Verify code follows Django/Python best practices
   - [ ] Check for any hardcoded values
   - [ ] Confirm logging is implemented

7. **Logging Check**:
   - [ ] Verify logging is implemented for payment creation
   - [ ] Check API calls are logged (without sensitive data)
   - [ ] Verify errors are logged with context
   - [ ] Confirm centralized logging service is used (if available)

8. **Timeout and Request Size Check**:
   - [ ] Verify timeout is configured for API calls
   - [ ] Check timeout errors are handled
   - [ ] Confirm request size limits are respected (max 30 items)
   - [ ] Verify timeout triggers retry logic

9. **Code Quality Check**:
   - [ ] Verify no hardcoded values
   - [ ] Check no trailing spaces
   - [ ] Confirm code follows best practices

## Notes

- PaymentFactory is the central point for payment creation
- All payment methods now go through payments-microservice
- ExternalPayment maintains compatibility with existing Payment model
- **API Views Compatibility**: API views (`MyOrderMethodView` in `orders/api_views.py`) automatically use microservice after PaymentFactory refactoring. Payment serializers work with ExternalPayment (extends Payment). No explicit changes needed to `api_views.py`.
- Keep error messages user-friendly
- Log all payment creation attempts for debugging
- Use extensive logging for debugging payment issues
- Configure appropriate timeouts (recommended: 30 seconds for API calls)
- Respect request size limits (maximum 30 items per request per user rules)
- Handle timeout errors gracefully with retry logic
- Never log sensitive data (API keys, full payment details, customer data)
- Check existing codebase before adding new code (per user rules)

## Related Tasks
- TASK-08: Complete ExternalPayment Model (prerequisite)
- TASK-10: Refactor WebPay Views (uses PaymentFactory)
- TASK-11: Refactor Inner Payment Views (uses PaymentFactory)
- TASK-12: Refactor Invoice Payment Views (uses PaymentFactory)
- TASK-13: Refactor PayPal Payment Flow (uses PaymentFactory)
