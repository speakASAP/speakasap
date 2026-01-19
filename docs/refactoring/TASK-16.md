# TASK-16: Comment Out Deprecated Payment Code

## Status
- **Phase**: Phase 2 - speakasap-portal refactoring
- **Priority**: Medium (cleanup task)
- **Dependencies**: TASK-10, TASK-11, TASK-12, TASK-13 (payment refactoring completed)
- **Estimated Time**: 1 hour

## Objective
Comment out deprecated payment processing code that has been moved to payments-microservice, keeping it for reference during migration period.

## Prerequisites
- TASK-10 completed (WebPay views refactored)
- TASK-11 completed (Inner payment views refactored)
- TASK-12 completed (Invoice payment views refactored)
- TASK-13 completed (PayPal payment flow refactored)

## Implementation Steps

### 1. Comment Out WebPay Form Signature Generation
**File**: `speakasap-portal/orders/webpay/forms.py`

- Comment out `WebpayForm` signature generation methods
- Comment out signature generation logic
- Add comments indicating code moved to payments-microservice
- Reference microservice location: `payments-microservice/src/payments/providers/webpay/webpay.service.ts`
- Keep code for reference during migration period

### 2. Comment Out WebPay Direct Form Submission
**File**: `speakasap-portal/orders/webpay/views.py`

- Comment out direct WebPay form creation code (if not already done in TASK-10)
- Comment out direct WebPay form submission code
- Add comments indicating code moved to payments-microservice
- Keep ProcessView for backward compatibility (update to handle webhooks)

### 3. Comment Out Invoice Number Generation
**File**: `speakasap-portal/orders/invoice/models.py`

- Comment out `generate_invoice_number()` function or method
- Comment out invoice number generation logic
- Add comments indicating code moved to payments-microservice
- Reference microservice location: `payments-microservice/src/payments/providers/invoice/invoice.service.ts`
- Keep function for reference

### 4. Comment Out Transaction Balance Methods (if applicable)
**File**: `speakasap-portal/orders/models.py`

- Comment out `Transaction.get_balance()` calls (if not already done in TASK-11)
- Keep `Transaction.get_balance()` method for reference (may be used elsewhere)
- Add comments indicating balance checking moved to payments-microservice
- Reference microservice location: `payments-microservice/src/payments/providers/inner/inner.service.ts`

### 5. Comment Out Direct Payment Provider Integrations
**Files**: Various payment-related files

- Comment out any remaining direct payment provider SDK calls
- Comment out direct API integrations
- Add comments indicating code moved to payments-microservice
- Keep code for reference during migration period

### 6. Add Migration Comments
**All Files**

- Add clear comments at the top of commented sections:
  ```python
  # DEPRECATED: This code has been moved to payments-microservice
  # Location: payments-microservice/src/payments/providers/{provider}/{provider}.service.ts
  # Date: {date}
  # Reason: Payment processing moved to shared microservice
  # TODO: Remove after migration period (check with team)
  ```
- Document what was moved and where
- Indicate migration completion date

### 7. Add Logging for Deprecated Code References
**All Files**

- Add logging statements where deprecated code is referenced (if any)
- Log when deprecated code paths are accessed (if fallback code exists)
- Use Django logging system: `import logging; logger = logging.getLogger(__name__)`
- Log deprecation warnings when deprecated code is called (if applicable)
- Use centralized logging service if available: `LOGGING_SERVICE_URL=http://logging-microservice:3367`
- Log levels: `warn` for deprecation warnings, `info` for migration status

## Files to Modify

1. `speakasap-portal/orders/webpay/forms.py`
2. `speakasap-portal/orders/webpay/views.py` (if not already done)
3. `speakasap-portal/orders/invoice/models.py`
4. `speakasap-portal/orders/models.py` (if applicable)
5. Any other files with deprecated payment code

## Comment Format

Use clear, consistent comment format:
```python
# ============================================================================
# DEPRECATED: Moved to payments-microservice
# ============================================================================
# This code has been moved to the shared payments-microservice.
# Location: payments-microservice/src/payments/providers/{provider}/{provider}.service.ts
# Date: {YYYY-MM-DD}
# Reason: Payment processing logic centralized in microservice
# TODO: Remove after migration period and verification
# ============================================================================

# [Original code commented out]
```

## Acceptance Criteria

- [ ] WebPay form signature generation is commented out
- [ ] WebPay direct form submission is commented out
- [ ] Invoice number generation is commented out
- [ ] Transaction balance calls are commented out (if applicable)
- [ ] All comments reference payments-microservice location
- [ ] Comments include migration date and reason
- [ ] Code is kept for reference (not deleted)
- [ ] Code compiles without errors
- [ ] Logging added for deprecated code references (if applicable)

## Verification Steps (for Orchestrating Agent)

1. **Code Review**:
   - [ ] Verify WebPay form code is commented out
   - [ ] Check WebPay views code is commented out
   - [ ] Verify invoice number generation is commented out
   - [ ] Check transaction balance calls are commented out
   - [ ] Confirm all comments reference microservice location
   - [ ] Verify comments include migration information

2. **Comment Quality Check**:
   - [ ] Check comments are clear and consistent
   - [ ] Verify comments include microservice location
   - [ ] Confirm comments include migration date
   - [ ] Check comments explain reason for deprecation

3. **Code Preservation Check**:
   - [ ] Verify code is commented, not deleted
   - [ ] Check code is readable in comments
   - [ ] Confirm code can be restored if needed

4. **Compilation Check**:
   - [ ] Run Django checks: `python manage.py check`
   - [ ] Verify no syntax errors
   - [ ] Check for any import errors

5. **Documentation Check**:
   - [ ] Verify deprecated code is documented
   - [ ] Check migration notes are clear
   - [ ] Confirm TODO items are added

## Notes

- Code is commented out, not deleted, for reference during migration
- Comments should clearly indicate where code was moved
- Keep code for rollback capability during migration period
- Remove commented code after migration period and verification
- Document any code that cannot be commented (e.g., required for compatibility)

## Related Tasks
- TASK-10: Refactor WebPay Views (may have already commented some code)
- TASK-11: Refactor Inner Payment Views (may have already commented some code)
- TASK-12: Refactor Invoice Payment Views (may have already commented some code)
- TASK-13: Refactor PayPal Payment Flow (may have already commented some code)

## Post-Migration

After migration period and verification:
- Remove commented code
- Update documentation
- Clean up migration comments
