# TASK-13: Refactor PayPal Payment Flow to Use payments-microservice

## Status
- **Phase**: Phase 2 - speakasap-portal refactoring
- **Priority**: High
- **Dependencies**: TASK-09 (PaymentFactory refactored)
- **Estimated Time**: 1-2 hours

## Objective
Refactor PayPal payment flow to use PaymentServiceClient instead of direct PayPal SDK integration.

## Prerequisites
- TASK-09 completed (PaymentFactory uses microservice)
- PayPal views exist: `speakasap-portal/orders/paypal/views.py`
- PayPal models exist: `speakasap-portal/orders/paypal/models.py`
- PaymentServiceClient available

## Implementation Steps

### 1. Update PaypalReturnView
**File**: `speakasap-portal/orders/paypal/views.py`

- Check payment status via PaymentServiceClient:
  - Call `PaymentServiceClient.get_payment_status(payment_id)`
  - Find ExternalPayment by `external_payment_id`
  - Verify payment status from microservice
- If payment approved/completed:
  - Update ExternalPayment status
  - Call `payment.pay()` → `order.pay()`
  - Redirect to success page
- If payment failed/cancelled:
  - Update ExternalPayment status
  - Redirect to error/cancel page
- Handle errors from microservice

### 2. Update PaypalPayment.create_payment()
**File**: `speakasap-portal/orders/paypal/models.py`

- Remove direct PayPal SDK calls
- Call PaymentFactory.create_payment() instead
- PaymentFactory now handles microservice call
- Pass `paymentMethod: 'paypal'` in PaymentFactory call
- Include customer information in metadata
- Store ExternalPayment with external_payment_id
- Return ExternalPayment object

### 3. Update PayPal Payment Creation Flow
**File**: `speakasap-portal/orders/paypal/views.py`

- Update payment creation to use PaymentFactory
- Get `redirectUrl` from ExternalPayment object
- Redirect user to PayPal gateway (from redirectUrl)
- Store ExternalPayment with external_payment_id
- Payment completion handled via webhook (TASK-14) or return handler

### 4. Comment Out Deprecated PayPal SDK Code
**File**: `speakasap-portal/orders/paypal/views.py` and `orders/paypal/models.py`

- Comment out direct PayPal SDK calls
- Comment out PayPal API integration code
- Add comments indicating code moved to payments-microservice
- Reference microservice location: `payments-microservice/src/payments/providers/paypal/paypal.service.ts`
- Keep code for reference during migration period

### 5. Add Extensive Logging
**File**: `speakasap-portal/orders/paypal/views.py` and `orders/paypal/models.py`

- Use Django logging system: `import logging; logger = logging.getLogger(__name__)`
- Log all PayPal payment creation attempts with context (orderId, amount, currency, customer info presence)
- Log PaymentFactory calls (without sensitive data)
- Log redirect URL generation and redirects to PayPal gateway
- Log payment status checks via microservice (paymentId, status)
- Log ExternalPayment creation and storage
- Log payment return handler processing (paymentId, status, approval/denial)
- Log errors with full context (order ID, payment ID, error details)
- Use centralized logging service if available: `LOGGING_SERVICE_URL=http://logging-microservice:3367`
- Log levels: `error` for failures, `warn` for warnings, `info` for operations, `debug` for detailed flow
- Never log sensitive data (API keys, full payment details, PayPal tokens, customer data)

## Files to Modify

1. `speakasap-portal/orders/paypal/views.py`
2. `speakasap-portal/orders/paypal/models.py`

## Flow Changes

**Old Flow**:
1. Create PayPal payment via SDK
2. Get approval URL from PayPal
3. Redirect user to PayPal
4. User returns to PaypalReturnView
5. Verify payment via SDK
6. Complete payment

**New Flow**:
1. Call PaymentFactory → payments-microservice API
2. Microservice creates PayPal payment
3. Get redirectUrl from microservice response
4. Redirect user to PayPal gateway
5. User returns to PaypalReturnView
6. Check payment status via microservice
7. Complete payment via `payment.pay()`
8. OR: Payment completion via webhook (TASK-14)

## Acceptance Criteria

- [ ] PaypalReturnView checks payment status via microservice
- [ ] PaypalPayment.create_payment() uses PaymentFactory
- [ ] ExternalPayment is created and stored
- [ ] redirectUrl is used to redirect to PayPal
- [ ] Payment completion works correctly
- [ ] Deprecated PayPal SDK code is commented out
- [ ] Comments reference payments-microservice location
- [ ] Code compiles without errors
- [ ] PayPal payment flow works end-to-end
- [ ] Extensive logging implemented for all operations (payment creation, status checks, return handling)

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [ ] Verify PaypalReturnView checks status via microservice
   - [ ] Check PaypalPayment.create_payment() uses PaymentFactory
   - [ ] Verify ExternalPayment is created
   - [ ] Confirm redirectUrl is used correctly
   - [ ] Check deprecated PayPal SDK code is commented out
   - [ ] Verify comments reference microservice location

2. **Flow Check**:
   - [ ] Test payment creation flow
   - [ ] Verify redirect to PayPal works
   - [ ] Test payment return handler
   - [ ] Check payment completion works

3. **Deprecated Code Check**:
   - [ ] Verify PayPal SDK calls are commented
   - [ ] Check PayPal API integration code is commented
   - [ ] Confirm comments explain code moved to microservice
   - [ ] Verify code is kept for reference

4. **Integration Check**:
   - [ ] Verify PaymentFactory integration works
   - [ ] Check webhook handling (TASK-14)
   - [ ] Confirm error handling works correctly

5. **Code Quality**:
   - [ ] Run linting checks
   - [ ] Verify code follows Django best practices
   - [ ] Check for any hardcoded values

## Notes

- PayPal payments now go through payments-microservice
- PayPal SDK integration is moved to microservice
- Payment completion can be handled via return handler or webhook
- Keep deprecated code for reference during migration
- PayPal credentials are configured in microservice

## Related Tasks
- TASK-09: Refactor PaymentFactory (prerequisite)
- TASK-14: Add Webhook Endpoint (handles payment completion)
- TASK-16: Comment Out Deprecated Code (related)
