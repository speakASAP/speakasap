import { HttpException, HttpStatus } from '@nestjs/common';

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function assertValidMonth(value: string, field: string): void {
  if (!MONTH_RE.test(value)) {
    throw new HttpException(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: `Invalid ${field}; expected YYYY-MM`,
          details: { field, value },
        },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export function firstOfMonthUtc(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function lastInstantOfMonthUtc(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
}

export function iterMonthsInclusive(monthFrom: string, monthTo: string): string[] {
  const out: string[] = [];
  const cur = firstOfMonthUtc(monthFrom);
  const end = firstOfMonthUtc(monthTo);
  if (cur.getTime() > end.getTime()) {
    return out;
  }
  for (let d = new Date(cur); d.getTime() <= end.getTime(); d.setUTCMonth(d.getUTCMonth() + 1)) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    out.push(`${y}-${m}`);
  }
  return out;
}

export function monthRangeCount(monthFrom: string, monthTo: string): number {
  return iterMonthsInclusive(monthFrom, monthTo).length;
}

export function assertMonthRangeBounded(
  monthFrom: string,
  monthTo: string,
  maxMonths: number,
): void {
  assertValidMonth(monthFrom, 'monthFrom');
  assertValidMonth(monthTo, 'monthTo');
  if (firstOfMonthUtc(monthFrom).getTime() > firstOfMonthUtc(monthTo).getTime()) {
    throw new HttpException(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'monthFrom must be <= monthTo',
          details: {},
        },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
  const n = monthRangeCount(monthFrom, monthTo);
  if (n > maxMonths) {
    throw new HttpException(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: `Range exceeds ${maxMonths} months`,
          details: { months: n },
        },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
