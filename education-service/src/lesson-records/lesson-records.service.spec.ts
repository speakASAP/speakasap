import { ForbiddenException } from '@nestjs/common';
import { LessonRecordsService } from './lesson-records.service';
import {
  LessonNotFoundError,
  LessonServiceUnavailableError,
} from '../lesson-client/lesson-client.types';
import type { PortalLesson, PortalRoster } from '../lesson-client/lesson-client.types';

const LESSON = 'f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477';

function portalLesson(overrides: Partial<PortalLesson> = {}): PortalLesson {
  return {
    uuid: LESSON,
    order: 1,
    teacherId: 182,
    start: '2026-08-09T10:00:00Z',
    isFinished: false,
    studentCourseUuid: 'sc-1',
    moduleClass: '',
    courseClass: '',
    needsTeacher: false,
    recommendation: 'old',
    toManager: '',
    ...overrides,
  };
}

function portalRoster(overrides: Partial<PortalRoster> = {}): PortalRoster {
  return {
    lessonUuid: LESSON,
    teacherId: 182,
    groups: [{ uuid: 'g-1', name: 'Group A', studentIds: [3, 7] }],
    studentIds: [3, 7],
    paidStudentIds: [3],
    names: new Map<number, string>(),
    ...overrides,
  };
}

/**
 * Builds the service with every dependency stubbed.
 *
 * `lessons` defaults to raising: an unstubbed portal lookup must never quietly succeed,
 * which is the exact class of bug this change removes.
 */
function buildService(opts: {
  lessons?: Partial<Record<'getLesson' | 'getRoster' | 'updateLesson', jest.Mock>>;
  record?: unknown;
  teacherId?: number | null;
  studentId?: number | null;
  staff?: boolean;
} = {}) {
  const lessons: any = {
    getLesson: jest.fn(async () => {
      throw new LessonServiceUnavailableError(LESSON, 'test did not stub getLesson');
    }),
    getRoster: jest.fn(async () => {
      throw new LessonServiceUnavailableError(LESSON, 'test did not stub getRoster');
    }),
    updateLesson: jest.fn(async () => portalLesson()),
    ...opts.lessons,
  };

  const prisma: any = {
    lesson: {
      findUnique: jest.fn(async () => {
        throw new Error('the local lesson table must never be read');
      }),
    },
    lessonRecord: { findUnique: jest.fn(async () => opts.record ?? null) },
    lessonRecordPart: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (fn: any) =>
      fn({
        lesson: {
          update: jest.fn(async () => {
            throw new Error('the local lesson table must never be written');
          }),
        },
        lessonRecord: { upsert: jest.fn(async () => ({})) },
        lessonRecordPart: { deleteMany: jest.fn(async () => ({})), createMany: jest.fn(async () => ({})) },
      }),
    ),
  };

  const users: any = {
    getTeacherId: jest.fn(async () => opts.teacherId ?? null),
    getStudentId: jest.fn(async () => opts.studentId ?? null),
  };
  const mediaTokens: any = { issue: jest.fn(), verify: jest.fn() };
  const storage: any = { presignPut: jest.fn(() => ({ url: 'https://s3/put' })), headObject: jest.fn() };

  const service = new LessonRecordsService(prisma, users, mediaTokens, storage, lessons);
  return { service, prisma, lessons, users };
}

const staffAuth: any = { sub: 'u-1', roles: ['admin'] };
const studentAuth: any = { sub: 'u-2', roles: ['student'] };

describe('LessonRecordsService lesson sourcing', () => {
  it('propagates LessonNotFoundError from the portal instead of a bare 404', async () => {
    const { service } = buildService({
      lessons: { getLesson: jest.fn().mockRejectedValue(new LessonNotFoundError(LESSON)) },
    });

    await expect(service.getState(LESSON, staffAuth, 'tok')).rejects.toBeInstanceOf(
      LessonNotFoundError,
    );
  });

  it('propagates a portal outage rather than reporting no record', async () => {
    const { service } = buildService({
      lessons: {
        getLesson: jest
          .fn()
          .mockRejectedValue(new LessonServiceUnavailableError(LESSON, 'ECONNREFUSED')),
      },
    });

    await expect(service.getState(LESSON, staffAuth, 'tok')).rejects.toBeInstanceOf(
      LessonServiceUnavailableError,
    );
  });

  it('never reads the local lesson table', async () => {
    const { service, prisma } = buildService({
      lessons: {
        getLesson: jest.fn().mockResolvedValue(portalLesson()),
        getRoster: jest.fn().mockResolvedValue(portalRoster()),
      },
    });

    await service.getState(LESSON, staffAuth, 'tok');

    expect(prisma.lesson.findUnique).not.toHaveBeenCalled();
  });
});

describe('LessonRecordsService access control from the portal roster', () => {
  it('separates paid access from attendance for playback', async () => {
    // Student 7 attends but has not paid. Playback is for payers only; treating
    // attendance as payment would hand recordings to students who never paid.
    const { service } = buildService({
      lessons: {
        getLesson: jest.fn().mockResolvedValue(portalLesson()),
        getRoster: jest.fn().mockResolvedValue(portalRoster()),
      },
      studentId: 7,
      record: { uuid: 'r-1', lessonUuid: LESSON, recordKey: 'k', processed: true, parts: [] },
    });

    await expect(service.createPlaybackAccess(LESSON, studentAuth, 'tok')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows an attending student to read state', async () => {
    const { service } = buildService({
      lessons: {
        getLesson: jest.fn().mockResolvedValue(portalLesson()),
        getRoster: jest.fn().mockResolvedValue(portalRoster()),
      },
      studentId: 7,
    });

    const state = await service.getState(LESSON, studentAuth, 'tok');

    expect(state.lessonUuid).toBe(LESSON);
  });

  it('denies a student who is on neither list', async () => {
    const { service } = buildService({
      lessons: {
        getLesson: jest.fn().mockResolvedValue(portalLesson()),
        getRoster: jest.fn().mockResolvedValue(portalRoster()),
      },
      studentId: 99,
    });

    await expect(service.getState(LESSON, studentAuth, 'tok')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
