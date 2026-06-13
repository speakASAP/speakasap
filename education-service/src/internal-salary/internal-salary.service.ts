import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type TeacherMapItem = { teacherId: number; legacyPortalUserId: number };
type Aggregate = {
  legacyPortalUserId: number;
  teacherId: number;
  finishedLessonCount: number;
  paidLessonCount: number;
  demoLessonCount: number;
  scheduledMinutes: number;
  payableMinutes: number;
  totalMinutes: number;
  recordedMinutes: number;
  recordUnavailableCount: number;
  missingRecordCount: number;
  fallbackPaidLessonCount: number;
  currency: string | null;
  warnings: string[];
};

@Injectable()
export class InternalSalaryService {
  private readonly logger = new Logger(InternalSalaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async periodAggregates(period: string, legacyPortalUserIds: number[]) {
    const teacherMap = await this.fetchTeacherMap(legacyPortalUserIds);
    const teacherById = new Map(teacherMap.map((item) => [item.teacherId, item.legacyPortalUserId]));
    const teacherIds = [...teacherById.keys()];
    const warnings: string[] = [];
    if (!teacherIds.length) {
      if (legacyPortalUserIds.length) {
        warnings.push('no_teacher_mapping_for_requested_legacy_users');
      }
      return this.response(period, [], warnings);
    }

    const { start, end } = periodBounds(period);
    const lessons = await this.prisma.lesson.findMany({
      where: {
        isFinished: true,
        start: { gte: start, lt: end },
        teacherId: { in: teacherIds },
      },
      select: {
        uuid: true,
        teacherId: true,
        moduleClass: true,
        start: true,
        studentCourse: { select: { courseDisplayTitle: true } },
        studentAccesses: { select: { isPaid: true } },
        lessonRecord: { select: { recordKey: true, recordUnavailable: true, parts: true, processed: true } },
      },
    });

    const byUser = new Map<number, Aggregate>();
    for (const lesson of lessons) {
      if (lesson.teacherId === null) {
        continue;
      }
      const legacyPortalUserId = teacherById.get(lesson.teacherId);
      if (!legacyPortalUserId) {
        continue;
      }
      const agg = getAggregate(byUser, legacyPortalUserId, lesson.teacherId);
      const title = lesson.studentCourse.courseDisplayTitle || '';
      const isDemo = /demo/i.test(lesson.moduleClass) || /demo|проб/i.test(title);
      const hasPaidAccess = lesson.studentAccesses.some((access) => access.isPaid);
      const record = lesson.lessonRecord;
      const hasRecord = Boolean(record?.recordKey) || partsCount(record?.parts) > 0;
      const unavailable = Boolean(record?.recordUnavailable && record.recordUnavailable.trim());
      const payableMinutes = isDemo && !hasRecord ? 0 : isDemo ? 30 : 60;

      agg.finishedLessonCount += 1;
      agg.scheduledMinutes += isDemo ? 30 : 60;
      agg.payableMinutes += payableMinutes;
      agg.totalMinutes += payableMinutes;
      if (hasRecord) {
        agg.recordedMinutes += payableMinutes;
      }
      if (hasPaidAccess) {
        agg.paidLessonCount += 1;
      }
      if (isDemo) {
        agg.demoLessonCount += 1;
      }
      if (unavailable) {
        agg.recordUnavailableCount += 1;
      }
      if (!hasRecord) {
        agg.missingRecordCount += 1;
        if (payableMinutes > 0) {
          agg.fallbackPaidLessonCount += 1;
        }
      }
    }

    return this.response(period, [...byUser.values()], warnings);
  }

  private async fetchTeacherMap(legacyPortalUserIds: number[]): Promise<TeacherMapItem[]> {
    const base = process.env.USER_SERVICE_URL?.replace(/\/$/, '');
    const token = process.env.USER_SERVICE_INTERNAL_TOKEN || process.env.INTERNAL_API_TOKEN || '';
    if (!base || !token) {
      this.logger.warn('USER_SERVICE_URL or internal token unset; salary aggregate teacher map is empty');
      return [];
    }
    const url = new URL(`${base}/api/v1/internal/teachers/legacy-user-map`);
    if (legacyPortalUserIds.length) {
      url.searchParams.set('legacyPortalUserIds', legacyPortalUserIds.join(','));
    }
    const timeoutMs = Number(process.env.HTTP_CLIENT_TIMEOUT_MS || '8000');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url.toString(), {
        headers: { 'X-Internal-Token': token },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`user_service_http_${res.status}`);
      }
      const body = (await res.json()) as { items?: TeacherMapItem[] };
      return (body.items ?? []).filter(
        (item) => Number.isInteger(item.teacherId) && Number.isInteger(item.legacyPortalUserId),
      );
    } catch (error) {
      this.logger.error(`teacher map fetch failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('user-service teacher mapping unavailable');
    } finally {
      clearTimeout(timer);
    }
  }

  private response(period: string, items: Aggregate[], warnings: string[]) {
    return {
      period,
      items,
      meta: {
        source: 'education-service',
        rulesVersion: 'legacy-salary-duration-v1-target-fallback',
        generatedAt: new Date().toISOString(),
        warnings,
      },
    };
  }
}

function getAggregate(map: Map<number, Aggregate>, legacyPortalUserId: number, teacherId: number): Aggregate {
  let agg = map.get(legacyPortalUserId);
  if (!agg) {
    agg = {
      legacyPortalUserId,
      teacherId,
      finishedLessonCount: 0,
      paidLessonCount: 0,
      demoLessonCount: 0,
      scheduledMinutes: 0,
      payableMinutes: 0,
      totalMinutes: 0,
      recordedMinutes: 0,
      recordUnavailableCount: 0,
      missingRecordCount: 0,
      fallbackPaidLessonCount: 0,
      currency: null,
      warnings: ['target_schema_has_no_legacy_lesson_duration_seconds; using 60_min_non_demo_30_min_demo_fallback'],
    };
    map.set(legacyPortalUserId, agg);
  }
  return agg;
}

function periodBounds(period: string): { start: Date; end: Date } {
  const [yearRaw, monthRaw] = period.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 0, 0, 0)),
  };
}

function partsCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}
