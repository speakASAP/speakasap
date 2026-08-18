import { HttpException } from '@nestjs/common';
import { assertImportedLessonSalaryCoverage } from './calculation-runs.service';

/**
 * The write gate for the imported-vs-aggregate hours source.
 *
 * `hours = importedLessonSalary?.qtyHours ?? aggregateHours` means imported legacy rows
 * WIN whenever any exist for a teacher. That was safe while the imports were the only
 * trustworthy source. It stopped being safe the moment education-service started
 * aggregating live portal lessons, because the imports stop at the 2026-06-26 ETL freeze:
 *
 *   2026-06  imported 48h   correct 134.38h   -> 86.38h underpaid across 10 teachers
 *   2026-07  imported  0h   correct ~128 lessons
 *   2026-08  imported  0h   correct  ~46 lessons
 *
 * A teacher with PARTIAL imports is the dangerous case: rows exist, so the `??` fallback
 * never fires and the stale number is used silently. One teacher was short 39 hours.
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

function imported(qtyHours: number, lessonExpenseCount: number, uuids: string[] = []) {
  return {
    legacyPortalUserId: 1,
    lessonExpenseCount,
    qtyHours,
    lessonUuids: new Set(uuids),
  };
}

function aggregate(totalMinutes: number, finishedLessonCount: number) {
  return { totalMinutes, finishedLessonCount } as never;
}

describe('assertImportedLessonSalaryCoverage', () => {
  it('allows imports that match the aggregate within tolerance', () => {
    // 2026-05: imported 170h vs computed 169.35h. Legacy rounding, not a stale import.
    expect(() =>
      assertImportedLessonSalaryCoverage('2026-05', [
        { legacyPortalUserId: 1, imported: imported(170, 171), aggregate: aggregate(169.35 * 60, 172) },
      ]),
    ).not.toThrow();
  });

  it('refuses a partially imported month rather than silently underpaying', () => {
    // The June case: 19 imported hours against 58 real ones for one teacher.
    expect(
      codeOf(() =>
        assertImportedLessonSalaryCoverage('2026-06', [
          { legacyPortalUserId: 197762, imported: imported(19, 19), aggregate: aggregate(58 * 60, 58) },
        ]),
      ),
    ).toBe('SALARY_IMPORTED_HOURS_STALE');
  });

  it('names every affected teacher, not just the first', () => {
    let details: Record<string, unknown> = {};
    try {
      assertImportedLessonSalaryCoverage('2026-06', [
        { legacyPortalUserId: 3, imported: imported(4, 4), aggregate: aggregate(8 * 60, 8) },
        { legacyPortalUserId: 197762, imported: imported(19, 19), aggregate: aggregate(58 * 60, 58) },
      ]);
    } catch (error) {
      const body = (error as HttpException).getResponse() as { error?: { details?: Record<string, unknown> } };
      details = body?.error?.details ?? {};
    }
    const stale = details.staleImportedTeachers as Array<{ legacyPortalUserId: number }>;
    expect(stale.map((s) => s.legacyPortalUserId).sort((a, b) => a - b)).toEqual([3, 197762]);
  });

  it('passes a teacher with no imports at all — the aggregate is used, which is correct', () => {
    // July/August: zero imports, so the ?? fallback fires and live data is used.
    expect(() =>
      assertImportedLessonSalaryCoverage('2026-07', [
        { legacyPortalUserId: 1, imported: undefined, aggregate: aggregate(60 * 60, 60) },
      ]),
    ).not.toThrow();
  });

  it('does not fault imports that EXCEED the aggregate', () => {
    // Legacy paid for something this aggregate cannot see (manual bonus, corrected row).
    // Paying more than computed is not the failure this gate is for; underpaying is.
    expect(() =>
      assertImportedLessonSalaryCoverage('2026-05', [
        { legacyPortalUserId: 1, imported: imported(10, 10), aggregate: aggregate(5 * 60, 5) },
      ]),
    ).not.toThrow();
  });

  it('tolerates sub-hour rounding drift', () => {
    // 0.5h under on a 40h month is legacy quantize noise, not a frozen import.
    expect(() =>
      assertImportedLessonSalaryCoverage('2026-05', [
        { legacyPortalUserId: 1, imported: imported(39.5, 40), aggregate: aggregate(40 * 60, 40) },
      ]),
    ).not.toThrow();
  });
});
