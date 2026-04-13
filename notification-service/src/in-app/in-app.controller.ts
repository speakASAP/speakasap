import { Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthContextUser } from '../shared/auth.types';
import { InAppService } from './in-app.service';

@Controller('in-app')
@UseGuards(JwtAuthGuard)
export class InAppController {
  constructor(private readonly inApp: InAppService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    return this.inApp.list(req.authUser as AuthContextUser, limit, cursor);
  }

  @Post('mark-all-read')
  markAll(@Req() req: Request): Promise<{ updated: number }> {
    return this.inApp.markAllRead(req.authUser as AuthContextUser);
  }

  @Patch(':id/read')
  markRead(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ id: string; read: boolean }> {
    return this.inApp.markRead(req.authUser as AuthContextUser, id);
  }
}
