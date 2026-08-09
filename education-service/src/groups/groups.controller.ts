import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupsService } from './groups.service';
import { isStaffUser } from '../shared/staff-access';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  async list(@Req() req: Request, @Query('page') page?: string, @Query('limit') limit?: string) {
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Staff access required');
    }
    return this.groups.list(page, limit);
  }

  @Get(':uuid')
  async getOne(@Req() req: Request, @Param('uuid') uuid: string) {
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Staff access required');
    }
    // Raises: groups live in the portal and the local copy is frozen. The response
    // shaping that used to live here went with it — see `shared/frozen-copy.ts`.
    return this.groups.getByUuid(uuid);
  }
}
