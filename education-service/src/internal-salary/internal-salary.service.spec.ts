import { ServiceUnavailableException } from '@nestjs/common';
import { InternalSalaryService } from './internal-salary.service';
import { LessonClientService } from '../lesson-client/lesson-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { PortalTeacherLesson } from '../lesson-client/lesson-client.types';

/**
 * These cover the source swap from the frozen `education_lesson` copy to the portal.
 *
 * The copy stopped at 2026-06-26, so anything finished after it was invisible to payroll.
 * The rules that decide what a teacher is PAID must not move with the source, so most of
 * what is asserted here is that the arithmetic is unchanged — plus the two inferences the
 * portal now answers authoritatively (`isDemo`, `scheduledMinutes`) and the one thing that
 * must still come from local data (`durationSeconds`).
 */

const PERIOD = '2026-05';
const TEACHER_ID = 182;
const LEGACY_USER_ID = 314082;

function portalLesson(over: Partial<PortalTeacherLesson> = {}): PortalTeacherLesson {
  return {
    uuid: 'f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477',
    teacherId: TEACHER_ID,
    start: '2026-05-14T10:00:00.000Z',
    isFinished: true,
    isDemo: false,
    isGroup: false,
    scheduledMinutes: 60,
    hasPaidAccess: true,
    studentCourseUuid: '0c5c3ea8-0000-0000-0000-000000000001',
    courseDisplayTitle: 'English B1',
    moduleClass: 'course_materials.data.en.ru.Module',
    record: { hasRecord: true, recordUnavailable: '', processed: true },
    ...over,
  };
}

/** `fetchTeacherMap` is private and hits user-service over HTTP; stub it structurally. */
function mockTeacherMap(
  service: InternalSalaryService,
  items: Array<{ teacherId: number; legacyPortalUserId: number }>,
): void {
  (service as unknown as Record<string, unknown>).fetchTeacherMap = jest
    .fn()
    .mockResolvedValue(items);
}

type Harness = {
  service: InternalSalaryService;
  listLessonsByTeachers: jest.Mock;
  findManyRecords: jest.Mock;
};

function harness(
  lessons: PortalTeacherLesson[],
  records: Array<{ lessonUuid: string; durationSeconds: number | null }> = [],
): Harness {
  const listLessonsByTeachers = jest.fn().mockResolvedValue(lessons);
  const findManyRecords = jest.fn().mockResolvedValue(records);
  const prisma = { lessonRecord: { findMany: findManyRecords } } as unknown as PrismaService;
  const lessonClient = { listLessonsByTeachers } as unknown as LessonClientService;
  const service = new InternalSalaryService(prisma, lessonClient);
  mockTeacherMap(service, [{ teacherId: TEACHER_ID, legacyPortalUserId: LEGACY_USER_ID }]);
  return { service, listLessonsByTeachers, findManyRecords };
}

async function aggregateOf(h: Harness) {
  const res = (await h.service.periodAggregates(PERIOD, [LEGACY_USER_ID])) as {
    items: Array<Record<string, unknown>>;
  };
  return res.items[0];
}

describe('InternalSalaryService period aggregates from the portal', () => {
  it('reads lessons from the portal, never from the frozen local copy', async () => {
    const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: 3600 }]);
    await aggregateOf(h);

    expect(h.listLessonsByTeachers).toHaveBeenCalledTimes(1);
    const [teacherIds, from, to] = h.listLessonsByTeachers.mock.calls[0];
    expect(teacherIds).toEqual([TEACHER_ID]);
    expect((from as Date).toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect((to as Date).toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('counts a full-length recorded lesson at its scheduled minutes', async () => {
    const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: 3600 }]);
    const agg = await aggregateOf(h);

    expect(agg.finishedLessonCount).toBe(1);
    expect(agg.payableMinutes).toBe(60);
    expect(agg.recordedMinutes).toBe(60);
    expect(agg.paidLessonCount).toBe(1);
  });

  it('joins duration locally by lesson uuid — the portal never supplies it', async () => {
    const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: 1800 }]);
    const agg = await aggregateOf(h);

    // 30 min against a 60 min slot is past the 5 min tolerance, so it pays the real length.
    expect(agg.payableMinutes).toBe(30);
    expect(agg.shortRecordCount).toBe(1);
  });

  it('pays the legacy fallback when the local record has no duration', async () => {
    const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: null }]);
    const agg = await aggregateOf(h);

    expect(agg.payableMinutes).toBe(60);
    expect(agg.missingDurationCount).toBe(1);
    expect(agg.warnings).toContain(
      'lesson_record_duration_seconds_missing; used legacy fallback salary minutes',
    );
  });

  it('trusts the portal isDemo over any course-title guess', async () => {
    // Title says nothing about demo; the portal decided from the course CODE.
    const lesson = portalLesson({ isDemo: true, scheduledMinutes: 30, courseDisplayTitle: 'English B1' });
    const h = harness([lesson], [{ lessonUuid: lesson.uuid, durationSeconds: 1800 }]);
    const agg = await aggregateOf(h);

    expect(agg.demoLessonCount).toBe(1);
    expect(agg.payableMinutes).toBe(30);
  });

  it('does NOT treat a Russian course title as a demo any more', async () => {
    // The old regex /demo|проб/i matched this title and wrongly paid it as a 30 min demo.
    const lesson = portalLesson({ isDemo: false, courseDisplayTitle: 'Пробный курс английского' });
    const h = harness([lesson], [{ lessonUuid: lesson.uuid, durationSeconds: 3600 }]);
    const agg = await aggregateOf(h);

    expect(agg.demoLessonCount).toBe(0);
    expect(agg.payableMinutes).toBe(60);
  });

  it('uses the portal scheduledMinutes for a group lesson rather than recomputing', async () => {
    const lesson = portalLesson({ isGroup: true, scheduledMinutes: 90 });
    const h = harness([lesson], [{ lessonUuid: lesson.uuid, durationSeconds: 5400 }]);
    const agg = await aggregateOf(h);

    expect(agg.scheduledMinutes).toBe(90);
    expect(agg.payableMinutes).toBe(90);
  });

  it('takes scheduledMinutes from the portal even when the local rule disagrees', async () => {
    // The legacy `Lesson.duration` rule is the portal's to apply, and it knows overrides
    // this service cannot see. A 45 min slot matches none of the local 30/60/90 branches,
    // so if this pays 60 the value is being recomputed rather than read.
    const lesson = portalLesson({ isDemo: false, isGroup: false, scheduledMinutes: 45 });
    const h = harness([lesson], [{ lessonUuid: lesson.uuid, durationSeconds: 2700 }]);
    const agg = await aggregateOf(h);

    expect(agg.scheduledMinutes).toBe(45);
    expect(agg.payableMinutes).toBe(45);
  });

  it('pays a demo with no recording nothing at all', async () => {
    const lesson = portalLesson({
      isDemo: true,
      scheduledMinutes: 30,
      record: { hasRecord: false, recordUnavailable: '', processed: false },
    });
    const h = harness([lesson], []);
    const agg = await aggregateOf(h);

    expect(agg.payableMinutes).toBe(0);
    expect(agg.demoUnpaidLessonCount).toBe(1);
  });

  it('counts an unavailable recording and still pays the fallback', async () => {
    const lesson = portalLesson({
      record: { hasRecord: true, recordUnavailable: 'storage object missing', processed: true },
    });
    const h = harness([lesson], [{ lessonUuid: lesson.uuid, durationSeconds: 3600 }]);
    const agg = await aggregateOf(h);

    expect(agg.recordUnavailableCount).toBe(1);
    expect(agg.payableMinutes).toBe(60);
  });

  it('aggregates a lesson finished AFTER the frozen copy cutoff', async () => {
    // The whole point of the swap: 2026-06-26 was the copy's last row.
    const lesson = portalLesson({ uuid: 'aaaaaaaa-0000-0000-0000-000000000009', start: '2026-08-05T09:00:00.000Z' });
    const h = harness([lesson], [{ lessonUuid: lesson.uuid, durationSeconds: 3600 }]);
    const agg = await aggregateOf(h);

    expect(agg.finishedLessonCount).toBe(1);
    expect(agg.payableMinutes).toBe(60);
  });

  it('raises when the portal is unreachable instead of reporting an empty month', async () => {
    const h = harness([]);
    h.listLessonsByTeachers.mockRejectedValue(new Error('portal down'));

    // An empty month and a failed lookup must never be indistinguishable to payroll.
    await expect(h.service.periodAggregates(PERIOD, [LEGACY_USER_ID])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('does not call the portal when no teacher mapping resolves', async () => {
    const h = harness([]);
    mockTeacherMap(h.service, []);

    const res = (await h.service.periodAggregates(PERIOD, [LEGACY_USER_ID])) as {
      meta: { warnings: string[] };
    };
    expect(res.meta.warnings).toContain('no_teacher_mapping_for_requested_legacy_users');
    expect(h.listLessonsByTeachers).not.toHaveBeenCalled();
  });

  it('skips a lesson whose teacher is outside the requested mapping', async () => {
    const h = harness([portalLesson({ teacherId: 999 })], []);
    const res = (await h.service.periodAggregates(PERIOD, [LEGACY_USER_ID])) as {
      items: unknown[];
    };
    expect(res.items).toHaveLength(0);
  });
});
