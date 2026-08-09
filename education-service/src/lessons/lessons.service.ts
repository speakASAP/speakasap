import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { LessonClientService } from '../lesson-client/lesson-client.service';

/**
 * Read-only lesson access for the public `/api/v1/lessons` routes.
 *
 * Sourced from the portal, which owns lessons. Until 2026-08-09 this read local copies
 * of the portal's Django tables, populated by a one-shot ETL that last ran 2026-06-26 —
 * so it served a frozen snapshot as though it were current, with nothing anywhere to say
 * so.
 *
 * LESSON-API: transitional — these routes predate the portal API and have no known
 * consumer (no caller in any repo, and no gateway traffic in the 7 days before
 * 2026-08-09). They are kept, rather than deleted, because they are publicly routed
 * through the gateway and absence of logged traffic is not proof of absence of a client.
 */
@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(private readonly lessons: LessonClientService) {}

  /**
   * RAISES. The portal exposes no "lessons of a student course" endpoint, and the local
   * table this used to page over is the frozen copy.
   *
   * Returning stale rows is the worse option by a wide margin: a caller cannot tell a
   * six-week-old page from a current one, which is precisely how the freeze went
   * unnoticed. If a real consumer appears, this raise names it — then add the endpoint to
   * `education/internal_api/` in the portal and repoint here.
   */
  async listByStudentCourse(studentCourseUuid: string, _page?: string, _limit?: string) {
    this.logger.error(
      `Refusing to list lessons for student course ${studentCourseUuid}: the portal exposes ` +
        'no list endpoint and the local lesson table is a copy frozen at 2026-06-26. ' +
        'If you are seeing this, a real consumer exists and the portal needs the endpoint.',
    );
    throw new ServiceUnavailableException({
      statusCode: 503,
      code: 'LESSON_LIST_UNAVAILABLE',
      message:
        'Listing lessons by student course is not available: lessons are owned by the portal, ' +
        'which exposes no list endpoint.',
    });
  }

  /**
   * One lesson, from the portal.
   *
   * `LessonNotFoundError` and `LessonServiceUnavailableError` propagate deliberately, so
   * "this lesson does not exist" stays distinguishable from "the portal could not be
   * asked". Collapsing them into one 404 is what made a frozen table look like ordinary
   * missing data.
   */
  async getByUuid(uuid: string) {
    const lesson = await this.lessons.getLesson(uuid);
    return {
      uuid: lesson.uuid,
      order: lesson.order,
      teacherId: lesson.teacherId,
      start: lesson.start,
      isFinished: lesson.isFinished,
      studentCourseUuid: lesson.studentCourseUuid,
      moduleClass: lesson.moduleClass,
      recommendation: lesson.recommendation,
      toManager: lesson.toManager,
    };
  }
}
