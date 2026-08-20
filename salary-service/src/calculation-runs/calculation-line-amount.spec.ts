import { HttpException } from '@nestjs/common';
import { calculationLineAmount } from './calculation-runs.service';

/**
 * The arithmetic that decides what one teacher is paid for a period.
 *
 * It lived inline inside a `prisma.calculationRun.create()` call, so the sum that becomes
 * a real person's pay could not be exercised without a database and had no tests at all.
 *
 * `amount` is a string with two decimals because it is stored as a Decimal and then
 * converted to minor units by `minorFromDecimal` — see payout-money.spec.ts. These two
 * files together cover the whole path from hours worked to the integer handed to
 * payment-service.
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

describe('calculationLineAmount', () => {
  it('adds the hourly component to the fixed monthly salary', () => {
    const res = calculationLineAmount({ rate: '350', salary: '5000', aggregateHours: 10 });

    expect(res.fromRate).toBe(3500);
    expect(res.fromSalary).toBe(5000);
    expect(res.amount).toBe('8500.00');
  });

  it('pays the fixed salary alone when no hours were worked', () => {
    // A salaried teacher with no lessons is still paid their salary, not zero.
    const res = calculationLineAmount({ rate: '350', salary: '5000', aggregateHours: 0 });

    expect(res.amount).toBe('5000.00');
  });

  it('pays the hourly component alone when there is no fixed salary', () => {
    const res = calculationLineAmount({ rate: '15', salary: '0', aggregateHours: 8 });

    expect(res.amount).toBe('120.00');
  });

  it('pays nothing when both components are zero', () => {
    const res = calculationLineAmount({ rate: '15', salary: '0', aggregateHours: 0 });

    expect(res.amount).toBe('0.00');
  });

  it('prefers imported legacy hours over the computed aggregate', () => {
    // The imports win wherever they exist. assertImportedLessonSalaryCoverage is what
    // stops them being used when they are staler than the aggregate.
    const res = calculationLineAmount({
      rate: '15',
      salary: '0',
      aggregateHours: 58,
      importedQtyHours: 19,
    });

    expect(res.hours).toBe(19);
    expect(res.amount).toBe('285.00');
  });

  it('uses imported hours even when they are ZERO, rather than falling through', () => {
    // `?? ` not `||`. An imported 0 is a real answer — the teacher taught nothing that the
    // legacy import knows of — and must not silently fall back to the aggregate.
    const res = calculationLineAmount({
      rate: '15',
      salary: '100',
      aggregateHours: 40,
      importedQtyHours: 0,
    });

    expect(res.hours).toBe(0);
    expect(res.amount).toBe('100.00');
  });

  it('handles fractional hours from recording-derived minutes', () => {
    // 7356 payable minutes / 60 = 122.6h, the shape the education aggregate produces.
    const res = calculationLineAmount({ rate: '15', salary: '0', aggregateHours: 122.6 });

    expect(res.amount).toBe('1839.00');
  });

  it('rounds the final amount to two decimals rather than leaving a long float', () => {
    // 0.1 * 3 is 0.30000000000000004 in IEEE754.
    const res = calculationLineAmount({ rate: '0.1', salary: '0', aggregateHours: 3 });

    expect(res.amount).toBe('0.30');
  });

  it('produces a string minorFromDecimal can consume exactly', () => {
    const res = calculationLineAmount({ rate: '15.75', salary: '0', aggregateHours: 1 });

    expect(res.amount).toBe('15.75');
    expect(Number(res.amount) * 100).toBeCloseTo(1575, 6);
  });

  it('raises rather than producing the string "NaN" from a broken rate', () => {
    // Without this the line stores amount "NaN", which later reaches payment-service.
    expect(codeOf(() => calculationLineAmount({ rate: 'abc', salary: '0', aggregateHours: 1 })))
      .toBe('SALARY_AMOUNT_INVALID');
  });

  it('raises on a broken salary', () => {
    expect(codeOf(() => calculationLineAmount({ rate: '15', salary: 'oops', aggregateHours: 1 })))
      .toBe('SALARY_AMOUNT_INVALID');
  });

  it('raises on non-finite hours', () => {
    expect(
      codeOf(() =>
        calculationLineAmount({ rate: '15', salary: '0', aggregateHours: Number.POSITIVE_INFINITY }),
      ),
    ).toBe('SALARY_AMOUNT_INVALID');
  });
});
