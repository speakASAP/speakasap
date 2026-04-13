import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthContextUser } from '../shared/auth.types';
import { LettersService } from './letters.service';

@Controller('letters')
@UseGuards(JwtAuthGuard)
export class LettersController {
  constructor(private readonly letters: LettersService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('userId') userId?: string,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    return this.letters.list(req.authUser as AuthContextUser, limit, cursor, userId);
  }

  @Get(':id')
  getOne(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.letters.getOne(req.authUser as AuthContextUser, id);
  }
}
