import { HttpException } from '@nestjs/common';
import { assertRunCanBeUnfinalized } from './calculation-runs.service';

/**
 * Rollback evidence for Goal 9.6.
 *
 * `finalize` flips draft -> finalized and nothing reverses it, but `finalized` is exactly
 * the state payout-runs requires ("Calculation run must be finalized"). So a run finalized
 * on bad inputs was a one-way door into the payout path — the operator's only options were
 * to pay it or to leave a wrong finalized run sitting there looking authoritative.
 *
 * This matters more since the rules changed: salary-duration-v4 pays the legacy 95% rule,
 * so a run finalized under v3 carries different numbers for the same month and there was
 * no way to withdraw it.
 *
 * Reversing is only safe while no payout has consumed the run. After that the money has
 * moved and the run is history, not a draft.
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

describe('assertRunCanBeUnfinalized', () => {
  it('allows reversing a finalized run that no payout has touched', () => {
    expect(() =>
      assertRunCanBeUnfinalized({ id: 'r1', status: 'finalized', payoutRunCount: 0 }),
    ).not.toThrow();
  });

  it('refuses once a payout run references it — the money may have moved', () => {
    expect(
      codeOf(() => assertRunCanBeUnfinalized({ id: 'r1', status: 'finalized', payoutRunCount: 1 })),
    ).toBe('SALARY_RUN_HAS_PAYOUTS');
  });

  it('refuses a run that is already a draft, rather than silently doing nothing', () => {
    // A no-op success would tell the operator the rollback worked when nothing happened.
    expect(
      codeOf(() => assertRunCanBeUnfinalized({ id: 'r1', status: 'draft', payoutRunCount: 0 })),
    ).toBe('SALARY_RUN_NOT_FINALIZED');
  });

  it('refuses a failed run', () => {
    expect(
      codeOf(() => assertRunCanBeUnfinalized({ id: 'r1', status: 'failed', payoutRunCount: 0 })),
    ).toBe('SALARY_RUN_NOT_FINALIZED');
  });

  it('reports the payout count so the operator knows what blocks them', () => {
    let details: Record<string, unknown> = {};
    try {
      assertRunCanBeUnfinalized({ id: 'r1', status: 'finalized', payoutRunCount: 3 });
    } catch (error) {
      const body = (error as HttpException).getResponse() as { error?: { details?: Record<string, unknown> } };
      details = body?.error?.details ?? {};
    }
    expect(details.payoutRunCount).toBe(3);
  });
});
