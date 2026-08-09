import { ServiceUnavailableException } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import {
  LessonNotFoundError,
  LessonServiceUnavailableError,
} from '../lesson-client/lesson-client.types';
import type { PortalLesson } from '../lesson-client/lesson-client.types';

const LESSON = 'f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477';

function portalLesson(overrides: Partial<PortalLesson> = {}): PortalLesson {
  return {
    uuid: LESSON,
    order: 3,
    teacherId: 182,
    start: '2026-08-09T10:00:00Z',
    isFinished: false,
    studentCourseUuid: 'sc-1',
    moduleClass: 'A2',
    courseClass: '',
    needsTeacher: false,
    recommendation: 'keep going',
    toManager: '',
    ...overrides,
  };
}

function harness() {
  const lessons: any = {
    getLesson: jest.fn(async () => {
      throw new LessonServiceUnavailableError(LESSON, 'test did not stub getLesson');
    }),
  };
  return { service: new LessonsService(lessons), lessons };
}

describe('LessonsService', () => {
  it('serves a lesson from the portal', async () => {
    const h = harness();
    h.lessons.getLesson.mockResolvedValue(portalLesson());

    const result = await h.service.getByUuid(LESSON);

    expect(result.uuid).toBe(LESSON);
    expect(result.teacherId).toBe(182);
    expect(result.studentCourseUuid).toBe('sc-1');
    expect(result.recommendation).toBe('keep going');
  });

  it('propagates a missing lesson rather than inventing a 404 of its own', async () => {
    const h = harness();
    h.lessons.getLesson.mockRejectedValue(new LessonNotFoundError(LESSON));

    await expect(h.service.getByUuid(LESSON)).rejects.toBeInstanceOf(LessonNotFoundError);
  });

  it('propagates a portal outage instead of reporting the lesson absent', async () => {
    const h = harness();
    h.lessons.getLesson.mockRejectedValue(
      new LessonServiceUnavailableError(LESSON, 'ECONNREFUSED'),
    );

    await expect(h.service.getByUuid(LESSON)).rejects.toBeInstanceOf(
      LessonServiceUnavailableError,
    );
  });

  /**
   * There is no portal endpoint listing a course's lessons, and the local table this used
   * to read is a copy frozen since 2026-06-26. Answering from it would hand out a
   * plausible page of stale rows with no indication anything was wrong, so the endpoint
   * refuses instead. Failing loudly is what makes an unknown consumer visible; the log
   * window that showed zero traffic here proves nothing on its own.
   */
  it('REFUSES to list lessons rather than serving them from the frozen copy', async () => {
    const h = harness();

    await expect(h.service.listByStudentCourse('sc-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
