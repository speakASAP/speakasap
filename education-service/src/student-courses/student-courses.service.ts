import { Injectable, Logger } from '@nestjs/common';
import { refuseFrozenCopyRead } from '../shared/frozen-copy';

/**
 * Student courses are owned by the portal. `education_studentcourse` here is a copy
 * frozen at 2026-06-26, so both reads refuse rather than serve stale rows.
 * See `shared/frozen-copy.ts`.
 */
@Injectable()
export class StudentCoursesService {
  private readonly logger = new Logger(StudentCoursesService.name);

  async list(_page?: string, _limit?: string): Promise<never> {
    return refuseFrozenCopyRead(this.logger, 'Student courses', 'list');
  }

  async getByUuid(uuid: string): Promise<never> {
    return refuseFrozenCopyRead(this.logger, 'Student courses', `uuid=${uuid}`);
  }
}
