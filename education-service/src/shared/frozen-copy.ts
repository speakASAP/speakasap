import { Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * LESSON-API: transitional — delete at legacy sunset.
 *
 * Refuses a read that could only be answered from `education_group`,
 * `education_studentcourse` or `education_homework`.
 *
 * Those tables are COPIES of the portal's Django tables, filled by a one-shot ETL that
 * last ran **2026-06-26**. Nothing refreshes them. Reading them returns rows that look
 * entirely normal — correct shape, plausible values, no error — while being weeks stale,
 * which is exactly how the freeze survived six weeks unnoticed on speakasap.
 *
 * The portal owns this data and exposes only per-lesson endpoints today. Until it exposes
 * the rest, refusing loudly is the only honest answer: a caller cannot detect staleness,
 * but it cannot miss a 503.
 *
 * These routes have no known consumer — no caller in any repo, and no gateway traffic in
 * the 7 days before 2026-08-09 — but they are publicly routed, and quiet logs are not
 * proof of no client. This raise is what makes an unknown one announce itself.
 */
export function refuseFrozenCopyRead(
  logger: Logger,
  what: string,
  detail: string,
): never {
  logger.error(
    `Refusing to read ${what} (${detail}): served from a copy of the portal's tables ` +
      'frozen at 2026-06-26. If you are seeing this, a real consumer exists and the ' +
      'portal needs the corresponding endpoint in education/internal_api/.',
  );
  throw new ServiceUnavailableException({
    statusCode: 503,
    code: 'FROZEN_COPY_UNAVAILABLE',
    message:
      `${what} is not available: this data is owned by the portal, and the local copy ` +
      'is frozen. It is not served rather than served stale.',
  });
}
