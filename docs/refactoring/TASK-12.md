# TASK-12: Refactor Invoice Payment Views to Use payments-microservice

## Status
- **Phase**: Phase 2 - speakasap-portal refactoring
- **Priority**: High
- **Dependencies**: TASK-09 (PaymentFactory refactored)
- **Estimated Time**: 1-2 hours

## Objective
Refactor Invoice payment views to use PaymentServiceClient instead of local invoice number generation and invoice record creation.

## Prerequisites
- TASK-09 completed (PaymentFactory uses microservice)
- Invoice views exist: `speakasap-portal/orders/invoice/views.py`
- Invoice models exist: `speakasap-portal/orders/invoice/models.py`
- PaymentServiceClient available

## Implementation Steps

### 1. Update PaymentCreateView
**File**: `speakasap-portal/orders/invoice/views.py`

- Replace invoice number generation with PaymentFactory usage
- PaymentFactory now calls microservice automatically (after TASK-09)
- Pass `paymentMethod: 'invoice'` in PaymentFactory call
- Include `userId` in metadata:
  - Extract user ID from request or order
  - Add to metadata: `{'userId': user_id}`
- Get invoice number from microservice response metadata:
  - Extract invoice number from response: `response.get('metadata', {}).get('invoiceNumber')`
  - Display invoice number to user
- Store ExternalPayment with external_payment_id
- Update payment confirmation to handle via webhook (TASK-14) or API call

### 2. Remove Invoice Number Generation
**File**: `speakasap-portal/orders/invoice/models.py`

- Comment out `generate_invoice_number()` function or method
- Comment out invoice number generation logic
- Add comments indicating logic moved to payments-microservice
- Reference microservice location: `payments-microservice/src/payments/providers/invoice/invoice.service.ts`
- Keep function for reference during migration period

### 3. Remove Local Invoice Payment Record Creation
**File**: `speakasap-portal/orders/invoice/views.py` or `orders/invoice/models.py`

- Comment out local invoice payment record creation
- Comment out InvoicePayment model creation code
- Add comments indicating logic moved to payments-microservice
- Invoice record creation now happens in microservice on payment creation
- Keep code for reference during migration period

### 4. Update Payment Confirmation
**File**: `speakasap-portal/orders/invoice/views.py`

- When bank transfer received, call payments-microservice API to confirm payment
- OR: Handle payment confirmation via webhook from payments-microservice (TASK-14)
- Update payment status when invoice is confirmed
- Call `payment.pay()` when payment is confirmed and completed

### 5. Add Extensive Logging
**File**: `speakasap-portal/orders/invoice/views.py`

- Use Django logging system: `import logging; logger = logging.getLogger(__name__)`
- Log all Invoice payment creation attempts with context (orderId, userId, amount, currency)
- Log PaymentFactory calls (without sensitive data)
- Log invoice number extraction from microservice response (invoice number, orderId)
- Log ExternalPayment creation and storage
- Log payment confirmation operations (invoice number, status changes)
- Log errors with full context (order ID, user ID, invoice number, error details)
- Use centralized logging service if available: `LOGGING_SERVICE_URL=http://logging-microservice:3367`
- Log levels: `error` for failures, `warn` for warnings, `info` for operations, `debug` for detailed flow
- Never log sensitive data (API keys, full payment details, user passwords)

## Files to Modify

1. `speakasap-portal/orders/invoice/views.py`
2. `speakasap-portal/orders/invoice/models.py`

## Flow Changes

**Old Flow**:
1. Generate invoice number locally
2. Create InvoicePayment record locally
3. Display invoice number to user
4. Wait for bank transfer
5. Confirm payment manually

**New Flow**:
1. Call PaymentFactory → payments-microservice API
2. Microservice generates invoice number
3. Microservice creates invoice record in database
4. Get invoice number from microservice response
5. Display invoice number to user
6. Payment confirmation via webhook or API call
7. Webhook calls `payment.pay()` when confirmed

## Acceptance Criteria

- [ ] PaymentCreateView uses PaymentFactory (which calls microservice)
- [ ] userId is included in metadata
- [ ] Invoice number is extracted from microservice response
- [ ] ExternalPayment is created and stored
- [ ] Invoice number generation is commented out
- [ ] Local invoice record creation is commented out
- [ ] Comments reference payments-microservice location
- [ ] Code compiles without errors
- [ ] Invoice payment flow works end-to-end
- [ ] Extensive logging implemented for all operations (payment creation, invoice number extraction, confirmation)

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [ ] Verify PaymentCreateView uses PaymentFactory
   - [ ] Check userId is included in metadata
   - [ ] Verify invoice number is extracted from response
   - [ ] Confirm ExternalPayment is created
   - [ ] Check invoice number generation is commented out
   - [ ] Verify local invoice record creation is commented out
   - [ ] Check comments reference microservice location

2. **Logic Check**:
   - [ ] Test payment creation flow
   - [ ] Verify invoice number is generated by microservice
   - [ ] Check invoice number is displayed to user
   - [ ] Test payment confirmation flow

3. **Deprecated Code Check**:
   - [ ] Verify generate_invoice_number() is commented
   - [ ] Check invoice record creation code is commented
   - [ ] Confirm comments explain code moved to microservice
   - [ ] Verify code is kept for reference

4. **Integration Check**:
   - [ ] Verify PaymentFactory integration works
   - [ ] Check webhook handling (TASK-14)
   - [ ] Confirm payment confirmation works

5. **Code Quality**:
   - [ ] Run linting checks
   - [ ] Verify code follows Django best practices
   - [ ] Check for any hardcoded values

## Notes

- Invoice payments now go through payments-microservice for invoice number generation
- Invoice record creation happens in microservice database
- Invoice number is returned in microservice response metadata
- Payment confirmation can be done via webhook or API call
- Keep deprecated code for reference during migration

## Related Tasks
- TASK-09: Refactor PaymentFactory (prerequisite)
- TASK-14: Add Webhook Endpoint (handles payment completion)
- TASK-16: Comment Out Deprecated Code (related)
