import { HttpException } from '@nestjs/common';
import { assertSalaryAggregateReady } from './calculation-runs.service';

/** The error code lives in the HttpException response body, not its message. */
function codeOf(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    const body = (error as HttpException).getResponse() as { error?: { code?: string } };
    return body?.error?.code ?? 'NO_CODE';
  }
  return 'DID_NOT_THROW';
}

/**
 * This gate is the last thing between a bad aggregate and real teacher payouts, and until
 * now nothing tested it.
 *
 * The case that prompted these tests: education-service renamed `shortRecordCount` to
 * `implausibleRecordCount` in salary-duration-v4. The old reader did
 * `readiness.shortRecordCount ?? 0`, so against a v4 aggregate it would have read zero
 * blockers and opened the gate — a silent failure in the worst possible place.
 */

type Readiness = Record<string, unknown>;

function result(readiness: Readiness, blockerSamples: unknown[] = [], warnings: string[] = []) {
  return {
    period: '2026-05',
    items: [],
    readiness,
    blockerSamples,
    warnings,
  } as never;
}

const CLEAN: Readiness = {
  salaryCalculationReady: true,
  missingDurationCount: 0,
  implausibleRecordCount: 0,
  teacherMappingMissingCount: 0,
};

describe('assertSalaryAggregateReady', () => {
  it('passes a clean v4 aggregate', () => {
    expect(() => assertSalaryAggregateReady(result(CLEAN), new Map())).not.toThrow();
  });

  it('refuses an aggregate carrying NEITHER count rather than assuming zero', () => {
    // The rename trap. Reading a missing field as 0 would silently authorise payouts.
    const unknownContract = {
      salaryCalculationReady: true,
      missingDurationCount: 0,
      teacherMappingMissingCount: 0,
    };

    expect(codeOf(() => assertSalaryAggregateReady(result(unknownContract), new Map()))).toBe(
      'SALARY_AGGREGATE_CONTRACT_UNKNOWN',
    );
  });

  it('still understands a legacy v3 aggregate that sends shortRecordCount', () => {
    const v3 = {
      salaryCalculationReady: true,
      missingDurationCount: 0,
      shortRecordCount: 0,
      teacherMappingMissingCount: 0,
    };

    expect(() => assertSalaryAggregateReady(result(v3), new Map())).not.toThrow();
  });

  it('blocks on an implausible record', () => {
    expect(
      codeOf(() =>
        assertSalaryAggregateReady(
          result({ ...CLEAN, salaryCalculationReady: false, implausibleRecordCount: 1 }),
          new Map(),
        ),
      ),
    ).toBe('SALARY_PARITY_BLOCKERS_PRESENT');
  });

  it('blocks on a missing teacher mapping', () => {
    expect(
      codeOf(() =>
        assertSalaryAggregateReady(
          result({ ...CLEAN, salaryCalculationReady: false, teacherMappingMissingCount: 1 }),
          new Map(),
        ),
      ),
    ).toBe('SALARY_PARITY_BLOCKERS_PRESENT');
  });

  it('blocks when the aggregate carries dependency warnings', () => {
    expect(
      codeOf(() => assertSalaryAggregateReady(result(CLEAN, [], ['portal_lookup_degraded']), new Map())),
    ).toBe('SALARY_PARITY_BLOCKERS_PRESENT');
  });
});
