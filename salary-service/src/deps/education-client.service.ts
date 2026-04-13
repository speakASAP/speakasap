import { Injectable, Logger } from '@nestjs/common';

/** Optional aggregates — education-service may expose this path in a later wave; salary stays HTTP-only. */
export type PeriodAggregateItem = {
  legacyPortalUserId: number;
  finishedLessonCount: number;
  totalMinutes: number;
};

@Injectable()
export class EducationClientService {
  private readonly logger = new Logger(EducationClientService.name);

  async fetchPeriodAggregates(
    period: string,
    legacyPortalUserIds: number[],
    internalToken: string,
  ): Promise<Map<number, PeriodAggregateItem>> {
    const base = process.env.EDUCATION_SERVICE_URL?.replace(/\/$/, '');
    if (!base) {
      this.logger.warn('EDUCATION_SERVICE_URL unset; period aggregates empty');
      return new Map();
    }
    const url = new URL(`${base}/api/v1/internal/salary/period-aggregates`);
    url.searchParams.set('period', period);
    if (legacyPortalUserIds.length) {
      url.searchParams.set('legacyPortalUserIds', legacyPortalUserIds.join(','));
    }
    const timeoutMs = Number(process.env.HTTP_CLIENT_TIMEOUT_MS || '8000');
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'X-Internal-Token': internalToken },
        signal: controller.signal,
      });
      const durationMs = Date.now() - started;
      if (res.status === 404 || res.status === 501) {
        this.logger.warn(
          `education period-aggregates not implemented status=${res.status} duration_ms=${durationMs}`,
        );
        return new Map();
      }
      if (!res.ok) {
        this.logger.error(
          `education period-aggregates failed status=${res.status} duration_ms=${durationMs}`,
        );
        throw new Error(`education_http_${res.status}`);
      }
      const body = (await res.json()) as { items?: PeriodAggregateItem[] };
      const map = new Map<number, PeriodAggregateItem>();
      for (const it of body.items ?? []) {
        map.set(it.legacyPortalUserId, it);
      }
      this.logger.log(`education period-aggregates ok duration_ms=${durationMs} count=${map.size}`);
      return map;
    } catch (e) {
      const durationMs = Date.now() - started;
      this.logger.error(
        `education period-aggregates error duration_ms=${durationMs} ${(e as Error).message}`,
      );
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}
