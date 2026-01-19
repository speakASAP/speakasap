# TASK-14: Add Webhook Endpoint in speakasap-portal

## Status
- **Phase**: Phase 2 - speakasap-portal refactoring
- **Priority**: Critical (required for payment completion)
- **Dependencies**: TASK-08 (ExternalPayment model)
- **Estimated Time**: 2 hours

## Objective
Create webhook endpoint in speakasap-portal to receive payment completion notifications from payments-microservice.

## Prerequisites
- TASK-08 completed (ExternalPayment model exists)
- Django views system working
- payments-microservice can send webhooks
- API key authentication available

## Implementation Steps

### 1. Create Webhook View
**File**: `speakasap-portal/orders/webhooks/views.py` (new file)

- Create webhook handler function or class-based view
- Accept POST requests with JSON payload
- Use `@csrf_exempt` decorator (webhook from external service)
- Verify webhook authentication:
  - Check `X-API-Key` header matches `PAYMENT_API_KEY` setting
  - Or verify signature if implemented
- Parse JSON payload
- Handle errors gracefully

### 2. Process Webhook Payload
**File**: `speakasap-portal/orders/webhooks/views.py`

- Extract fields from payload:
  - `paymentId` - Payment ID from microservice
  - `orderId` - Order ID from speakasap-portal
  - `status` - Payment status: 'completed', 'failed'
  - `paymentMethod` - Payment method: 'webpay', 'inner', 'invoice', 'paypal'
  - `event` - Event type: 'completed', 'failed'
  - `timestamp` - ISO8601 timestamp
  - `metadata` - Additional metadata
- Find ExternalPayment by `external_payment_id`:
  - Query: `ExternalPayment.objects.get(external_payment_id=paymentId)`
  - Handle Payment.DoesNotExist exception
- Handle idempotency:
  - Check if payment already processed (status already 'completed')
  - Skip processing if already completed
  - Log duplicate webhook delivery

### 3. Update Payment Status
**File**: `speakasap-portal/orders/webhooks/views.py`

- Update ExternalPayment status:
  - Set `status` = payload status ('completed' or 'failed')
  - Save ExternalPayment
- Update related payment model if needed:
  - Find related payment model (PaypalPayment, WebpayPayment, etc.)
  - Update payment status if applicable

### 4. Complete Payment
**File**: `speakasap-portal/orders/webhooks/views.py`

- If status is 'completed':
  - Get payment object from ExternalPayment
  - Call `payment.pay(request=None)` method
  - This triggers `order.pay()` chain
  - Handle payment completion errors
- If status is 'failed':
  - Update payment status
  - Log failure
  - Do NOT call `payment.pay()`

### 5. Handle Different Payment Methods
**File**: `speakasap-portal/orders/webhooks/views.py`

- Handle payment method-specific logic if needed:
  - **PayPal**: Update PaypalPayment model status via ExternalPayment
  - **WebPay**: Update WebpayPayment model status via ExternalPayment
  - **Inner**: Update InnerPayment model status via ExternalPayment, complete order
  - **Invoice**: Update InvoicePayment model status via ExternalPayment
- Most logic is handled by `payment.pay()` method

### 6. Error Handling
**File**: `speakasap-portal/orders/webhooks/views.py`

- Log webhook processing errors using Django logging
- Return appropriate HTTP status codes:
  - `200 OK` - Webhook processed successfully
  - `400 Bad Request` - Invalid payload or missing fields
  - `401 Unauthorized` - Authentication failed
  - `404 Not Found` - Payment not found
  - `500 Internal Server Error` - Processing error
- Handle missing payment records gracefully
- Handle duplicate webhook deliveries (idempotency)
- Log all webhook processing for audit trail

### 7. Add URL Route
**File**: `speakasap-portal/orders/urls.py`

- Add webhook URL route:
  ```python
  url(r'^api/payments/webhook$', webhook_handler, name='payment_webhook')
  ```
- Or use path() if using Django 2.0+:
  ```python
  path('api/payments/webhook', webhook_handler, name='payment_webhook')
  ```
- Import webhook handler from views

### 8. Create Webhooks App Structure (if needed)
**File**: `speakasap-portal/orders/webhooks/__init__.py`

- Create `__init__.py` file
- Export webhook handler if needed

### 9. Add Extensive Logging
**File**: `speakasap-portal/orders/webhooks/views.py`

- Use Django logging system: `import logging; logger = logging.getLogger(__name__)`
- Log all webhook processing attempts with context (paymentId, orderId, status, paymentMethod)
- Log ExternalPayment lookup (success/failure)
- Log payment status updates
- Log payment completion calls (`payment.pay()`)
- Log idempotency checks (duplicate webhook detection)
- Log authentication attempts (success/failure)
- Log errors with full context (payment ID, order ID, error details)
- Use centralized logging service if available: `LOGGING_SERVICE_URL=http://logging-microservice:3367`
- Log levels: `error` for failures, `warn` for warnings, `info` for operations, `debug` for detailed flow
- Never log sensitive data (API keys, full payment details)

## Files to Create/Modify

1. `speakasap-portal/orders/webhooks/views.py` (new)
2. `speakasap-portal/orders/webhooks/__init__.py` (new)
3. `speakasap-portal/orders/urls.py` (add route)

## Webhook Payload Structure

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

## Acceptance Criteria

- [ ] Webhook endpoint is created at `/api/payments/webhook`
- [ ] Endpoint accepts POST requests with JSON payload
- [ ] Webhook authentication is verified (API key)
- [ ] ExternalPayment is found by external_payment_id
- [ ] Payment status is updated correctly
- [ ] `payment.pay()` is called when status is 'completed'
- [ ] Idempotency is handled (duplicate webhooks)
- [ ] Error handling works correctly
- [ ] Appropriate HTTP status codes are returned
- [ ] All webhook processing is logged
- [ ] Code compiles without errors
- [ ] Extensive logging is implemented for all operations
- [ ] No hardcoded values (use environment variables)
- [ ] No trailing spaces in code

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [ ] Verify webhook endpoint is created
   - [ ] Check webhook authentication is implemented
   - [ ] Verify ExternalPayment lookup works
   - [ ] Check payment status update logic
   - [ ] Confirm `payment.pay()` is called correctly
   - [ ] Verify idempotency handling
   - [ ] Check error handling is implemented
   - [ ] Verify logging is implemented

2. **URL Check**:
   - [ ] Verify URL route is added to `orders/urls.py`
   - [ ] Check URL pattern matches `/api/payments/webhook`
   - [ ] Confirm URL name is 'payment_webhook'

3. **Integration Check**:
   - [ ] Test webhook endpoint with sample payload
   - [ ] Verify ExternalPayment lookup works
   - [ ] Test payment completion flow
   - [ ] Check idempotency (duplicate webhooks)
   - [ ] Verify error handling

4. **Security Check**:
   - [ ] Verify API key authentication works
   - [ ] Check CSRF exemption is applied
   - [ ] Confirm webhook payload validation

5. **Code Quality**:
   - [ ] Run linting checks
   - [ ] Verify code follows Django best practices
   - [ ] Check for any hardcoded values

6. **Logging Check**:
   - [ ] Verify logging is implemented for webhook processing
   - [ ] Check ExternalPayment lookup is logged
   - [ ] Verify payment completion is logged
   - [ ] Confirm idempotency checks are logged
   - [ ] Check errors are logged with context
   - [ ] Verify centralized logging service is used (if available)

7. **Code Quality Check**:
   - [ ] Verify no hardcoded values
   - [ ] Check no trailing spaces
   - [ ] Confirm code follows best practices

## Notes

- Webhook endpoint receives notifications from payments-microservice
- Payment completion triggers `payment.pay()` → `order.pay()` chain
- Idempotency prevents duplicate processing
- Authentication via API key prevents unauthorized webhooks
- Log all webhook processing for debugging and audit trail
- Use extensive logging for debugging webhook issues
- Never log sensitive data (API keys, full payment details)
- Check existing codebase before adding new code (per user rules)

## Related Tasks
- TASK-08: Complete ExternalPayment Model (prerequisite)
- TASK-05: Complete Webhook Handling (sends webhooks to this endpoint)
- TASK-09 through TASK-13: Payment refactoring (creates ExternalPayment records)
