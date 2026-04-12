import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
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
    const row = await this.groups.getByUuid(uuid);
    if (!row) {
      throw new NotFoundException('Group not found');
    }
    return {
      uuid: row.uuid,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      studentIds: row.groupStudents.map((s) => s.studentId),
      studentCourseUuids: row.studentCourses.map((c) => c.uuid),
    };
  }
}
