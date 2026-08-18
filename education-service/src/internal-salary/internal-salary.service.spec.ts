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
    expect(agg.implausibleRecordCount).toBe(0);
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

  describe('the legacy 95% full-lesson rule', () => {
    // expenses/salary/utils.py get_record_length_in_hours():
    //   "Если запись длиннее, чем 95% длительности урока, то считаем урок полным."
    // Threshold is RELATIVE to the lesson, not a flat 5 minutes. For a 60 min lesson that
    // is 57 min; the old absolute rule paid a full lesson from 55 min and so overpaid the
    // 55-57 band. Demos were worst hit: 5 min of slack on a 30 min lesson vs legacy's 1.5.

    it('pays a full lesson just above 95% of its duration', async () => {
      // 3421s = 57.02 min > 57.0 min threshold.
      const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: 3421 }]);
      const agg = await aggregateOf(h);

      expect(agg.payableMinutes).toBe(60);
    });

    it('pays the real length AT exactly 95%, matching legacy\'s strict >', async () => {
      // legacy: `if duration_hours > duration_limit` — exactly 95% is NOT a full lesson.
      // 3420s is exactly 95% of 3600s, so this pays 57, not 60.
      const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: 3420 }]);
      const agg = await aggregateOf(h);

      expect(agg.payableMinutes).toBe(57);
    });

    it('pays the real length just below 95%, where the old rule wrongly paid full', async () => {
      // 3414s = 56.9 min. Legacy pays 57; the 5-minute rule paid 60.
      const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: 3414 }]);
      const agg = await aggregateOf(h);

      expect(agg.payableMinutes).toBe(57);
    });

    it('scales the threshold with a 90 minute group lesson', async () => {
      // 95% of 90 min is 85.5 min. 5100s = 85.0 min is BELOW it, though the old absolute
      // rule treated it as full.
      const lesson = portalLesson({ isGroup: true, scheduledMinutes: 90 });
      const h = harness([lesson], [{ lessonUuid: lesson.uuid, durationSeconds: 5100 }]);
      const agg = await aggregateOf(h);

      expect(agg.payableMinutes).toBe(85);
    });

    it('scales the threshold with a 30 minute demo', async () => {
      // 95% of 30 min is 28.5 min. A 26 min demo paid full under the 5-minute rule.
      const lesson = portalLesson({ isDemo: true, scheduledMinutes: 30 });
      const h = harness([lesson], [{ lessonUuid: lesson.uuid, durationSeconds: 1560 }]);
      const agg = await aggregateOf(h);

      expect(agg.payableMinutes).toBe(26);
    });

    it('never pays more than the scheduled length for a long recording', async () => {
      // legacy: quantize(min(duration_hours, lesson.duration))
      const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: 7200 }]);
      const agg = await aggregateOf(h);

      expect(agg.payableMinutes).toBe(60);
    });
  });

  describe('readiness reflects unexplained records, not correct proration', () => {
    it('stays ready when a recording is simply shorter than the slot', async () => {
      // A prorated lesson is the rule working, not a blocker. Flagging every short record
      // would gate every run forever, since short recordings are normal.
      const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: 2155 }]);
      const res = (await h.service.periodAggregates(PERIOD, [LEGACY_USER_ID])) as {
        items: Array<Record<string, unknown>>;
        meta: { readiness: { salaryCalculationReady: boolean; implausibleRecordCount: number } };
      };

      expect(res.items[0].payableMinutes).toBe(36);
      expect(res.meta.readiness.implausibleRecordCount).toBe(0);
      expect(res.meta.readiness.salaryCalculationReady).toBe(true);
    });

    it('blocks when a record exists but its duration is unknown', async () => {
      // This one IS unexplained: we cannot tell what to pay, so it falls back and says so.
      const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: null }]);
      const res = (await h.service.periodAggregates(PERIOD, [LEGACY_USER_ID])) as {
        meta: { readiness: { salaryCalculationReady: boolean; missingDurationCount: number } };
      };

      expect(res.meta.readiness.missingDurationCount).toBe(1);
      expect(res.meta.readiness.salaryCalculationReady).toBe(false);
    });

    it('flags a recording too short to be a real lesson', async () => {
      // 60 seconds against a 60 minute slot is not a short lesson, it is a broken upload.
      // Legacy pays the real length either way, but a human should look.
      const h = harness([portalLesson()], [{ lessonUuid: portalLesson().uuid, durationSeconds: 60 }]);
      const res = (await h.service.periodAggregates(PERIOD, [LEGACY_USER_ID])) as {
        items: Array<Record<string, unknown>>;
        meta: { readiness: { implausibleRecordCount: number; salaryCalculationReady: boolean } };
      };

      expect(res.items[0].payableMinutes).toBe(1);
      expect(res.meta.readiness.implausibleRecordCount).toBe(1);
      expect(res.meta.readiness.salaryCalculationReady).toBe(false);
    });
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
