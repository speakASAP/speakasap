# TASK-10: Refactor WebPay Views to Use payments-microservice

## Status
- **Phase**: Phase 2 - speakasap-portal refactoring
- **Priority**: High
- **Dependencies**: TASK-09 (PaymentFactory refactored)
- **Estimated Time**: 2 hours

## Objective
Refactor WebPay views to use PaymentServiceClient instead of direct WebPay form generation, and comment out deprecated code.

## Prerequisites
- TASK-09 completed (PaymentFactory uses microservice)
- WebPay views exist: `speakasap-portal/orders/webpay/views.py`
- WebPay forms exist: `speakasap-portal/orders/webpay/forms.py`
- PaymentServiceClient available

## Implementation Steps

### 1. Update PaymentView
**File**: `speakasap-portal/orders/webpay/views.py`

- Replace direct Webpay form generation with PaymentFactory usage
- PaymentFactory now calls microservice automatically (after TASK-09)
- Extract billing details from form/request
- Build metadata with billing information for ADDINFO XML
- Get `redirectUrl` from ExternalPayment object
- Redirect user to WebPay gateway URL (from redirectUrl)
- Store ExternalPayment with external_payment_id
- Keep billing form handling (still needed to collect billing data)
- Pass billing data via metadata to microservice

### 2. Update ProcessView (Callback Handler)
**File**: `speakasap-portal/orders/webpay/views.py`

- Option A: Remove direct Webpay callback processing (WebPay calls microservice directly)
- Option B: Keep as fallback and forward to payments-microservice webhook endpoint
- Recommended: Update to handle webhook from payments-microservice instead of direct WebPay callback
- Process webhook payload from payments-microservice
- Find ExternalPayment by external_payment_id
- Update payment status
- Call `payment.pay()` if completed
- Keep view for backward compatibility initially

### 3. Update WebpayPayment.create_payment()
**File**: `speakasap-portal/orders/webpay/models.py`

- Remove direct WebPay form generation
- Call PaymentFactory.create_payment() instead
- PaymentFactory now handles microservice call
- Store ExternalPayment with external_payment_id
- Return ExternalPayment object

### 4. Comment Out Deprecated Code
**File**: `speakasap-portal/orders/webpay/forms.py`

- Comment out `WebpayForm` signature generation methods
- Comment out signature generation logic
- Add comments indicating code moved to payments-microservice
- Reference payments-microservice location: `payments-microservice/src/payments/providers/webpay/webpay.service.ts`
- Keep code for reference during migration period

**File**: `speakasap-portal/orders/webpay/views.py`

- Comment out direct WebPay form creation code
- Comment out direct WebPay form submission code
- Add comments indicating code moved to payments-microservice
- Keep ProcessView for backward compatibility (update to handle webhooks)

### 5. Add Extensive Logging
**File**: `speakasap-portal/orders/webpay/views.py`

- Use Django logging system: `import logging; logger = logging.getLogger(__name__)`
- Log all WebPay payment creation attempts with context (orderId, amount, currency, billing details presence)
- Log PaymentFactory calls (without sensitive data)
- Log redirect URL generation and redirects to WebPay gateway
- Log ExternalPayment creation and storage
- Log webhook processing (if ProcessView updated)
- Log errors with full context (order ID, payment ID, error details)
- Use centralized logging service if available: `LOGGING_SERVICE_URL=http://logging-microservice:3367`
- Log levels: `error` for failures, `warn` for warnings, `info` for operations, `debug` for detailed flow
- Never log sensitive data (API keys, full payment details, billing addresses, card numbers)

## Files to Modify

1. `speakasap-portal/orders/webpay/views.py`
2. `speakasap-portal/orders/webpay/models.py`
3. `speakasap-portal/orders/webpay/forms.py`

## Flow Changes

**Old Flow**:
1. Generate WebPay form with signature
2. Submit form to WebPay gateway
3. Receive callback at ProcessView
4. Process payment directly

**New Flow**:
1. Collect billing details (form)
2. Call PaymentFactory → payments-microservice API
3. Get redirectUrl from microservice
4. Redirect user to WebPay gateway
5. WebPay calls payments-microservice webhook
6. payments-microservice calls speakasap-portal webhook
7. Process payment via webhook handler

## Acceptance Criteria

- [ ] PaymentView uses PaymentFactory (which calls microservice)
- [ ] Billing details are passed via metadata
- [ ] redirectUrl is used to redirect to WebPay gateway
- [ ] ExternalPayment is created and stored
- [ ] ProcessView is updated to handle webhooks (or removed if not needed)
- [ ] Deprecated code is commented out with clear notes
- [ ] Comments reference payments-microservice location
- [ ] Code compiles without errors
- [ ] WebPay payment flow works end-to-end
- [ ] Extensive logging implemented for all operations (payment creation, redirects, webhook processing)

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [ ] Verify PaymentView uses PaymentFactory
   - [ ] Check billing details are passed via metadata
   - [ ] Verify redirectUrl is used correctly
   - [ ] Confirm ExternalPayment is created
   - [ ] Check ProcessView is updated or removed
   - [ ] Verify deprecated code is commented out
   - [ ] Check comments reference microservice location

2. **Flow Check**:
   - [ ] Test payment creation flow
   - [ ] Verify redirect to WebPay gateway works
   - [ ] Check billing data is passed correctly
   - [ ] Confirm ExternalPayment is stored

3. **Deprecated Code Check**:
   - [ ] Verify WebpayForm signature generation is commented
   - [ ] Check direct form creation is commented
   - [ ] Confirm comments explain code moved to microservice
   - [ ] Verify code is kept for reference

4. **Integration Check**:
   - [ ] Verify PaymentFactory integration works
   - [ ] Check webhook handling (if ProcessView updated)
   - [ ] Confirm backward compatibility (if needed)

5. **Code Quality**:
   - [ ] Run linting checks
   - [ ] Verify code follows Django best practices
   - [ ] Check for any hardcoded values

## Notes

- WebPay now goes through payments-microservice for signature generation
- Billing details are still collected in speakasap-portal (for ADDINFO XML)
- ProcessView may be kept for backward compatibility or removed
- Deprecated code is kept for reference during migration
- Webhook handling is done in TASK-14

## Related Tasks
- TASK-09: Refactor PaymentFactory (prerequisite)
- TASK-14: Add Webhook Endpoint (handles payment completion)
- TASK-16: Comment Out Deprecated Code (related)
