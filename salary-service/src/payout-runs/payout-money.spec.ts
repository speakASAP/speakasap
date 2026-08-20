import { HttpException } from '@nestjs/common';
import { minorFromDecimal, assertPayoutFlowsEnabled } from './payout-runs.service';

/**
 * The money conversion and the flag that lets any payout happen at all.
 *
 * `minorFromDecimal` is the last transformation before an amount is handed to
 * payment-service, so an error here is a real over- or under-payment to a real person.
 * Nothing tested it before.
 */

function codeOf(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    const body = (error as HttpException).getResponse() as { error?: { code?: string } };
    return body?.error?.code ?? 'NO_CODE';
  }
  return 'DID_NOT_THROW';
}

describe('minorFromDecimal', () => {
  it('converts a whole amount', () => {
    expect(minorFromDecimal('350', 'CZK')).toBe(35000);
  });

  it('converts two decimal places exactly', () => {
    expect(minorFromDecimal('15.75', 'EUR')).toBe(1575);
  });

  it('does not lose the classic binary-float cases', () => {
    // 0.1 + 0.2 territory. 8.7 * 100 is 869.9999... in IEEE754; truncation would pay 869.
    expect(minorFromDecimal('8.70', 'EUR')).toBe(870);
    expect(minorFromDecimal('1.10', 'EUR')).toBe(110);
    expect(minorFromDecimal('2.30', 'EUR')).toBe(230);
    expect(minorFromDecimal('4.35', 'EUR')).toBe(435);
  });

  it('rounds a half-cent up rather than truncating it away', () => {
    // Deliberately pinning CURRENT behaviour: Math.round. If this ever needs to be
    // banker's rounding, that is a decision to make explicitly, not to discover.
    expect(minorFromDecimal('0.005', 'EUR')).toBe(1);
    expect(minorFromDecimal('0.004', 'EUR')).toBe(0);
  });

  it('handles a zero payout', () => {
    expect(minorFromDecimal('0', 'CZK')).toBe(0);
    expect(minorFromDecimal('0.00', 'CZK')).toBe(0);
  });

  it('handles an amount large enough to matter for a monthly payroll', () => {
    expect(minorFromDecimal('12345.67', 'CZK')).toBe(1234567);
  });

  it('returns an integer, never a fraction of a minor unit', () => {
    for (const amount of ['1.005', '99.999', '0.001', '7.777']) {
      const result = minorFromDecimal(amount, 'EUR');
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('raises rather than handing payment-service a NaN amount', () => {
    // NaN would reach payment-service AS AN AMOUNT. Raising is the only safe answer:
    // there is no correct number to substitute, and paying zero silently is not one.
    for (const bad of ['not-a-number', '', 'NaN', 'Infinity', '12,50']) {
      expect(codeOf(() => minorFromDecimal(bad, 'EUR'))).toBe('SALARY_AMOUNT_INVALID');
    }
  });

  it('raises on a negative amount — salary is never a withdrawal', () => {
    expect(codeOf(() => minorFromDecimal('-10.00', 'EUR'))).toBe('SALARY_AMOUNT_INVALID');
  });
});

describe('assertPayoutFlowsEnabled', () => {
  const original = process.env.SALARY_PAYOUT_FLOWS_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SALARY_PAYOUT_FLOWS_ENABLED;
    } else {
      process.env.SALARY_PAYOUT_FLOWS_ENABLED = original;
    }
  });

  it('allows payouts only when explicitly enabled', () => {
    process.env.SALARY_PAYOUT_FLOWS_ENABLED = 'true';
    expect(() => assertPayoutFlowsEnabled()).not.toThrow();
  });

  it('refuses when the flag is unset', () => {
    delete process.env.SALARY_PAYOUT_FLOWS_ENABLED;
    expect(codeOf(() => assertPayoutFlowsEnabled())).toBe('SALARY_PAYOUT_FLOWS_DISABLED');
  });

  it('refuses anything other than the exact string "true"', () => {
    // A truthy-looking value must not open the money path.
    for (const value of ['1', 'yes', 'TRUE', 'True', 'enabled', '']) {
      process.env.SALARY_PAYOUT_FLOWS_ENABLED = value;
      expect(codeOf(() => assertPayoutFlowsEnabled())).toBe('SALARY_PAYOUT_FLOWS_DISABLED');
    }
  });
});
