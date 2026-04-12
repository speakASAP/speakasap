import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagersService } from './managers.service';

@Controller('managers')
@UseGuards(JwtAuthGuard)
export class ManagersController {
  constructor(private readonly managers: ManagersService) {}

  @Get('me')
  getMe(@Req() req: Request): Promise<Record<string, unknown>> {
    return this.managers.getMe(req.authUser!);
  }
}
