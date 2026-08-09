import { Injectable, Logger } from '@nestjs/common';
import { refuseFrozenCopyRead } from '../shared/frozen-copy';

/**
 * Groups are owned by the portal. `education_group` here is a copy frozen at 2026-06-26,
 * so both reads refuse rather than serve stale rows. See `shared/frozen-copy.ts`.
 */
@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  async list(_page?: string, _limit?: string): Promise<never> {
    return refuseFrozenCopyRead(this.logger, 'Groups', 'list');
  }

  async getByUuid(uuid: string): Promise<never> {
    return refuseFrozenCopyRead(this.logger, 'Groups', `uuid=${uuid}`);
  }
}
