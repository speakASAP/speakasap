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
import { HomeworksService } from './homeworks.service';
import { isStaffUser } from '../shared/staff-access';

@Controller('homeworks')
@UseGuards(JwtAuthGuard)
export class HomeworksController {
  constructor(private readonly svc: HomeworksService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('lessonUuid') lessonUuid: string | undefined,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Staff access required');
    }
    if (!lessonUuid) {
      throw new BadRequestException('Query lessonUuid is required');
    }
    return this.svc.listByLesson(lessonUuid, page, limit);
  }

  @Get(':uuid')
  async getOne(@Req() req: Request, @Param('uuid') uuid: string) {
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Staff access required');
    }
    return this.svc.getByUuid(uuid);
  }
}
