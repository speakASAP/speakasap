import {
  BadRequestException,
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
import { LessonsService } from './lessons.service';
import { isStaffUser } from '../shared/staff-access';

@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class LessonsController {
  constructor(private readonly svc: LessonsService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('studentCourseUuid') studentCourseUuid: string | undefined,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Staff access required');
    }
    if (!studentCourseUuid) {
      throw new BadRequestException('Query studentCourseUuid is required');
    }
    return this.svc.listByStudentCourse(studentCourseUuid, page, limit);
  }

  @Get(':uuid')
  async getOne(@Req() req: Request, @Param('uuid') uuid: string) {
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Staff access required');
    }
    return this.svc.getByUuid(uuid);
  }
}
