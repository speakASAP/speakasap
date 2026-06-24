import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type TeacherMapItem = { teacherId: number; legacyPortalUserId: number };
type Aggregate = {
  legacyPortalUserId: number;
  teacherId: number;
  finishedLessonCount: number;
  paidLessonCount: number;
  demoLessonCount: number;
  demoUnpaidLessonCount: number;
  demoPayableLessonCount: number;
  scheduledMinutes: number;
  payableMinutes: number;
  totalMinutes: number;
  recordedMinutes: number;
  recordUnavailableCount: number;
  missingRecordCount: number;
  missingDurationCount: number;
  shortRecordCount: number;
  fallbackPaidLessonCount: number;
  currency: string | null;
  warnings: string[];
};

type BlockerSample = {
  lessonUuid: string;
  teacherId: number | null;
  legacyPortalUserId: number | null;
  reason: string;
  lessonStart: string | null;
  scheduledMinutes?: number;
  durationSeconds?: number | null;
  isDemo?: boolean;
};

const BLOCKER_SAMPLE_LIMIT = 200;

@Injectable()
export class InternalSalaryService {
  private readonly logger = new Logger(InternalSalaryService.name);

  private readonly serviceName = process.env.SERVICE_NAME || 'speakasap-education';

  constructor(private readonly prisma: PrismaService) {}

  async periodAggregates(period: string, legacyPortalUserIds: number[]) {
    const teacherMap = await this.fetchTeacherMap(legacyPortalUserIds);
    const teacherById = new Map(teacherMap.map((item) => [item.teacherId, item.legacyPortalUserId]));
    const teacherIds = [...teacherById.keys()];
    const warnings: string[] = [];
    const missingTeacherMappingLegacyUserIds = legacyPortalUserIds.filter(
      (id) => !teacherMap.some((item) => item.legacyPortalUserId === id),
    );
    if (!teacherIds.length) {
      if (legacyPortalUserIds.length) {
        warnings.push('no_teacher_mapping_for_requested_legacy_users');
      }
      return this.response(period, [], warnings, {
        missingTeacherMappingLegacyUserIds,
        blockerSamples: missingTeacherMappingLegacyUserIds.slice(0, BLOCKER_SAMPLE_LIMIT).map((id) => ({
          lessonUuid: '',
          teacherId: null,
          legacyPortalUserId: id,
          reason: 'teacher_mapping_missing',
          lessonStart: null,
        })),
      });
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
        studentCourse: {
          select: {
            courseDisplayTitle: true,
            group: { select: { groupStudents: { select: { studentId: true } } } },
          },
        },
        studentAccesses: { select: { isPaid: true } },
        lessonRecord: {
          select: { recordKey: true, recordUnavailable: true, durationSeconds: true, parts: true, processed: true },
        },
      },
    });

    const byUser = new Map<number, Aggregate>();
    const blockerSamples: BlockerSample[] = missingTeacherMappingLegacyUserIds
      .slice(0, BLOCKER_SAMPLE_LIMIT)
      .map((id) => ({
        lessonUuid: '',
        teacherId: null,
        legacyPortalUserId: id,
        reason: 'teacher_mapping_missing',
        lessonStart: null,
      }));
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
      const isGroup = (lesson.studentCourse.group?.groupStudents.length ?? 0) > 1;
      const scheduledMinutes = scheduledLessonMinutes(isDemo, isGroup);
      const record = lesson.lessonRecord;
      const hasRecord = Boolean(record?.recordKey) || partsCount(record?.parts) > 0;
      const unavailable = Boolean(record?.recordUnavailable && record.recordUnavailable.trim());
      const durationSeconds = Number.isInteger(record?.durationSeconds) ? record?.durationSeconds ?? null : null;
      const payable = salaryPayableMinutes({ isDemo, hasRecord, unavailable, scheduledMinutes, durationSeconds });
      const payableMinutes = payable.minutes;
      const missingDuration = hasRecord && !unavailable && durationSeconds === null;
      const shortRecord =
        hasRecord &&
        !unavailable &&
        durationSeconds !== null &&
        durationSeconds < scheduledMinutes * 60 - FULL_LESSON_TOLERANCE_SECONDS;

      agg.finishedLessonCount += 1;
      agg.scheduledMinutes += scheduledMinutes;
      agg.payableMinutes += payableMinutes;
      agg.totalMinutes += payableMinutes;
      if (hasRecord && payable.source === 'record_duration') {
        agg.recordedMinutes += payableMinutes;
      }
      if (payable.source === 'missing_duration_fallback') {
        addWarning(agg, 'lesson_record_duration_seconds_missing; used legacy fallback salary minutes');
      }
      if (missingDuration) {
        agg.missingDurationCount += 1;
        pushBlockerSample(blockerSamples, {
          lessonUuid: lesson.uuid,
          teacherId: lesson.teacherId,
          legacyPortalUserId,
          reason: 'lesson_record_duration_seconds_missing',
          lessonStart: lesson.start?.toISOString() ?? null,
          scheduledMinutes,
          durationSeconds: null,
          isDemo,
        });
      }
      if (shortRecord) {
        agg.shortRecordCount += 1;
        addWarning(agg, 'short_record_duration_requires_salary_parity_review');
        pushBlockerSample(blockerSamples, {
          lessonUuid: lesson.uuid,
          teacherId: lesson.teacherId,
          legacyPortalUserId,
          reason: 'short_record_duration',
          lessonStart: lesson.start?.toISOString() ?? null,
          scheduledMinutes,
          durationSeconds,
          isDemo,
        });
      }
      if (hasPaidAccess) {
        agg.paidLessonCount += 1;
      }
      if (isDemo) {
        agg.demoLessonCount += 1;
        if (payableMinutes === 0) {
          agg.demoUnpaidLessonCount += 1;
        } else {
          agg.demoPayableLessonCount += 1;
        }
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

    return this.response(period, [...byUser.values()], warnings, {
      missingTeacherMappingLegacyUserIds,
      blockerSamples,
    });
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
        headers: { 'X-Internal-Token': token, 'X-Service-Name': this.serviceName },
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

  private response(
    period: string,
    items: Aggregate[],
    warnings: string[],
    extras?: {
      missingTeacherMappingLegacyUserIds?: number[];
      blockerSamples?: BlockerSample[];
    },
  ) {
    const missingDurationCount = items.reduce((sum, item) => sum + item.missingDurationCount, 0);
    const shortRecordCount = items.reduce((sum, item) => sum + item.shortRecordCount, 0);
    const teacherMappingMissingCount = extras?.missingTeacherMappingLegacyUserIds?.length ?? 0;
    return {
      period,
      items,
      meta: {
        source: 'education-service',
        rulesVersion: 'salary-duration-v3-record-length-5min-tolerance',
        generatedAt: new Date().toISOString(),
        readiness: {
          salaryCalculationReady:
            missingDurationCount === 0 &&
            shortRecordCount === 0 &&
            teacherMappingMissingCount === 0,
          missingDurationCount,
          shortRecordCount,
          teacherMappingMissingCount,
          missingTeacherMappingLegacyUserIds: extras?.missingTeacherMappingLegacyUserIds ?? [],
        },
        blockerSamples: extras?.blockerSamples ?? [],
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
      demoUnpaidLessonCount: 0,
      demoPayableLessonCount: 0,
      scheduledMinutes: 0,
      payableMinutes: 0,
      totalMinutes: 0,
      recordedMinutes: 0,
      recordUnavailableCount: 0,
      missingRecordCount: 0,
      missingDurationCount: 0,
      shortRecordCount: 0,
      fallbackPaidLessonCount: 0,
      currency: null,
      warnings: ['salary_duration_rule_v3: record duration capped at scheduled lesson length with five_minute_full_lesson_tolerance'],
    };
    map.set(legacyPortalUserId, agg);
  }
  return agg;
}

type PayableSource = 'record_duration' | 'missing_duration_fallback' | 'demo_without_record';

function scheduledLessonMinutes(isDemo: boolean, isGroup: boolean): number {
  if (isDemo) {
    return 30;
  }
  return isGroup ? 90 : 60;
}

const FULL_LESSON_TOLERANCE_SECONDS = 5 * 60;

function salaryPayableMinutes(input: {
  isDemo: boolean;
  hasRecord: boolean;
  unavailable: boolean;
  scheduledMinutes: number;
  durationSeconds: number | null;
}): { minutes: number; source: PayableSource } {
  if (!input.hasRecord && input.isDemo) {
    return { minutes: 0, source: 'demo_without_record' };
  }
  if (!input.hasRecord || input.unavailable || input.durationSeconds === null) {
    return { minutes: input.isDemo ? 30 : 60, source: 'missing_duration_fallback' };
  }
  const scheduledSeconds = input.scheduledMinutes * 60;
  if (scheduledSeconds - input.durationSeconds <= FULL_LESSON_TOLERANCE_SECONDS) {
    return { minutes: input.scheduledMinutes, source: 'record_duration' };
  }
  return { minutes: Math.min(Math.round(input.durationSeconds / 60), input.scheduledMinutes), source: 'record_duration' };
}

function addWarning(agg: Aggregate, warning: string): void {
  if (!agg.warnings.includes(warning)) {
    agg.warnings.push(warning);
  }
}

function pushBlockerSample(samples: BlockerSample[], sample: BlockerSample): void {
  if (samples.length < BLOCKER_SAMPLE_LIMIT) {
    samples.push(sample);
  }
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
