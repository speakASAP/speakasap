# TASK-11: Refactor Inner Payment Views to Use payments-microservice

## Status
- **Phase**: Phase 2 - speakasap-portal refactoring
- **Priority**: High
- **Dependencies**: TASK-09 (PaymentFactory refactored)
- **Estimated Time**: 1-2 hours

## Objective
Refactor Inner payment views to use PaymentServiceClient instead of local balance checking and transaction creation.

## Prerequisites
- TASK-09 completed (PaymentFactory uses microservice)
- InnerPaymentView exists: `speakasap-portal/orders/views.py`
- Transaction model exists: `speakasap-portal/orders/models.py`
- PaymentServiceClient available

## Implementation Steps

### 1. Update InnerPaymentView
**File**: `speakasap-portal/orders/views.py`

- Replace balance checking logic with PaymentFactory usage
- PaymentFactory now calls microservice automatically (after TASK-09)
- Pass `paymentMethod: 'inner'` in PaymentFactory call
- Include `userId` in metadata:
  - Extract user ID from request or order
  - Add to metadata: `{'userId': user_id}`
- Handle insufficient balance error from payments-microservice:
  - Catch error with code `INSUFFICIENT_BALANCE`
  - Display user-friendly error message
  - Return error response
- Store ExternalPayment with external_payment_id
- Keep existing UI/template (no UI changes needed)
- Payment completion handled via webhook (TASK-14)

### 2. Remove Local Balance Checking
**File**: `speakasap-portal/orders/views.py`

- Comment out `Transaction.get_balance()` calls
- Comment out local balance checking logic
- Add comments indicating logic moved to payments-microservice
- Reference microservice location: `payments-microservice/src/payments/providers/inner/inner.service.ts`
- Keep Transaction.get_balance() method for reference (may be used elsewhere)

### 3. Remove Local Transaction Creation
**File**: `speakasap-portal/orders/views.py`

- Comment out local transaction creation logic
- Comment out balance deduction code
- Add comments indicating logic moved to payments-microservice
- Transaction creation now happens in microservice on payment completion
- Keep code for reference during migration period

### 4. Update Payment Completion Flow
**File**: `speakasap-portal/orders/views.py`

- Remove direct payment completion logic
- Payment completion handled via webhook from payments-microservice (TASK-14)
- Webhook handler will call `payment.pay()` when payment completes
- Update any completion handlers to wait for webhook

### 5. Add Extensive Logging
**File**: `speakasap-portal/orders/views.py`

- Use Django logging system: `import logging; logger = logging.getLogger(__name__)`
- Log all Inner payment creation attempts with context (orderId, userId, amount, currency)
- Log PaymentFactory calls (without sensitive data)
- Log balance checking via microservice (userId, balance check result)
- Log insufficient balance errors with context (userId, required amount, available balance)
- Log ExternalPayment creation and storage
- Log payment completion waiting for webhook
- Log errors with full context (order ID, user ID, payment ID, error details)
- Use centralized logging service if available: `LOGGING_SERVICE_URL=http://logging-microservice:3367`
- Log levels: `error` for failures, `warn` for warnings, `info` for operations, `debug` for detailed flow
- Never log sensitive data (API keys, full payment details, user passwords)

## Files to Modify

1. `speakasap-portal/orders/views.py` (InnerPaymentView)

## Flow Changes

**Old Flow**:
1. Check user balance locally
2. Create payment if balance sufficient
3. Deduct balance immediately
4. Complete order

**New Flow**:
1. Call PaymentFactory → payments-microservice API
2. Microservice checks balance
3. Microservice validates payment
4. Payment completion via webhook
5. Microservice deducts balance on completion
6. Webhook calls `payment.pay()` → `order.pay()`

## Acceptance Criteria

- [ ] InnerPaymentView uses PaymentFactory (which calls microservice)
- [ ] userId is included in metadata
- [ ] Insufficient balance error is handled correctly
- [ ] ExternalPayment is created and stored
- [ ] Local balance checking is commented out
- [ ] Local transaction creation is commented out
- [ ] Comments reference payments-microservice location
- [ ] Code compiles without errors
- [ ] Inner payment flow works end-to-end
- [ ] Extensive logging implemented for all operations (payment creation, balance checks, error handling)

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [ ] Verify InnerPaymentView uses PaymentFactory
   - [ ] Check userId is included in metadata
   - [ ] Verify insufficient balance error handling
   - [ ] Confirm ExternalPayment is created
   - [ ] Check local balance checking is commented out
   - [ ] Verify local transaction creation is commented out
   - [ ] Check comments reference microservice location

2. **Logic Check**:
   - [ ] Test payment creation flow
   - [ ] Verify balance checking is done by microservice
   - [ ] Test insufficient balance error handling
   - [ ] Confirm payment completion via webhook

3. **Deprecated Code Check**:
   - [ ] Verify Transaction.get_balance() calls are commented
   - [ ] Check transaction creation code is commented
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

- Inner payments now go through payments-microservice for balance checking
- Balance deduction happens in microservice on payment completion
- Payment completion is handled via webhook (TASK-14)
- Keep Transaction.get_balance() method for reference (may be used elsewhere)
- Deprecated code is kept for reference during migration

## Related Tasks
- TASK-09: Refactor PaymentFactory (prerequisite)
- TASK-14: Add Webhook Endpoint (handles payment completion)
- TASK-16: Comment Out Deprecated Code (related)
