import { Logger } from '@nestjs/common';

const OP = 'OPERATIONAL_FAILURE';

/** High-signal logs for monitoring (grep `OPERATIONAL_FAILURE`). */
export function logOperationalFailure(
  logger: Logger,
  fields: Record<string, string | number | boolean | null | undefined>,
): void {
  const payload = {
    severity: 'error',
    tag: OP,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  logger.error(`${OP} ${JSON.stringify(payload)}`);
}
