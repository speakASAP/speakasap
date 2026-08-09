import { Injectable, Logger } from '@nestjs/common';
import { refuseFrozenCopyRead } from '../shared/frozen-copy';

/**
 * Homework is owned by the portal. `education_homework` here is a copy frozen at
 * 2026-06-26, so both reads refuse rather than serve stale rows.
 * See `shared/frozen-copy.ts`.
 *
 * Worth noting for whoever repoints this: homework is student-visible work, so stale
 * rows here would show a student the wrong assignments — a sharper failure than the
 * admin-facing group and course lists.
 */
@Injectable()
export class HomeworksService {
  private readonly logger = new Logger(HomeworksService.name);

  async listByLesson(lessonUuid: string, _page?: string, _limit?: string): Promise<never> {
    return refuseFrozenCopyRead(this.logger, 'Homework', `lessonUuid=${lessonUuid}`);
  }

  async getByUuid(uuid: string): Promise<never> {
    return refuseFrozenCopyRead(this.logger, 'Homework', `uuid=${uuid}`);
  }
}
