import { HttpException, HttpStatus, Logger } from '@nestjs/common';

const MAX_RETRIES = 2;

export async function fetchJsonWithRetry<T>(
  label: string,
  url: string,
  init: RequestInit,
  logger: Logger,
): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(url, init);
      const durationMs = Date.now() - started;
      if (res.status === 502 || res.status === 503) {
        logger.warn(`${label} attempt=${attempt} status=${res.status} duration_ms=${durationMs}`);
        lastErr = new Error(`upstream ${res.status}`);
        await sleep(150 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        logger.error(`${label} failed status=${res.status} duration_ms=${durationMs}`);
        throw new HttpException(
          {
            error: {
              code: 'DEPENDENCY_UNAVAILABLE',
              message: `${label} returned ${res.status}`,
              details: { url: stripQuery(url) },
            },
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
      logger.log(`${label} ok duration_ms=${durationMs}`);
      return (await res.json()) as T;
    } catch (e) {
      const durationMs = Date.now() - started;
      if (e instanceof HttpException) {
        throw e;
      }
      lastErr = e as Error;
      logger.warn(`${label} attempt=${attempt} error=${(e as Error).message} duration_ms=${durationMs}`);
      await sleep(150 * (attempt + 1));
    }
  }
  throw new HttpException(
    {
      error: {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: lastErr?.message || `${label} failed`,
        details: { url: stripQuery(url) },
      },
    },
    HttpStatus.BAD_GATEWAY,
  );
}

function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
