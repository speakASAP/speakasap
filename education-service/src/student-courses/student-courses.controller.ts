import { Controller, ForbiddenException, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StudentCoursesService } from './student-courses.service';
import { isStaffUser } from '../shared/staff-access';

@Controller('student-courses')
@UseGuards(JwtAuthGuard)
export class StudentCoursesController {
  constructor(private readonly svc: StudentCoursesService) {}

  @Get()
  async list(@Req() req: Request, @Query('page') page?: string, @Query('limit') limit?: string) {
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Staff access required');
    }
    return this.svc.list(page, limit);
  }

  @Get(':uuid')
  async getOne(@Req() req: Request, @Param('uuid') uuid: string) {
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Staff access required');
    }
    return this.svc.getByUuid(uuid);
  }
}
