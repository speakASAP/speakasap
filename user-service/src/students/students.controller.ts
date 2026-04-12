import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get('me')
  getMe(@Req() req: Request): Promise<Record<string, unknown>> {
    return this.students.getMe(req.authUser!);
  }

  @Patch('me')
  patchMe(@Req() req: Request, @Body() body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.students.patchMe(req.authUser!, body);
  }

  @Get(':id')
  getById(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.students.getById(req.authUser!, Number(id));
  }

  @Get()
  list(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('country') country?: string,
    @Query('managerId') managerId?: string,
    @Query('search') search?: string,
  ): Promise<unknown> {
    return this.students.list(req.authUser!, page, limit, country, managerId, search);
  }
}
