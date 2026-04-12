import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TeachersService } from './teachers.service';

@Controller('teachers')
@UseGuards(JwtAuthGuard)
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get('me')
  getMe(@Req() req: Request): Promise<Record<string, unknown>> {
    return this.teachers.getMe(req.authUser!);
  }

  @Patch('me')
  patchMe(@Req() req: Request, @Body() body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.teachers.patchMe(req.authUser!, body);
  }

  @Get(':id')
  getById(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.teachers.getById(req.authUser!, Number(id));
  }

  @Get()
  list(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('languageCode') languageCode?: string,
  ): Promise<unknown> {
    return this.teachers.list(req.authUser!, page, limit, languageCode);
  }
}
