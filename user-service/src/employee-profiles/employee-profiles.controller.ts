import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmployeeProfilesService } from './employee-profiles.service';

@Controller('employee-profiles')
@UseGuards(JwtAuthGuard)
export class EmployeeProfilesController {
  constructor(private readonly profiles: EmployeeProfilesService) {}

  @Get('me')
  getMe(@Req() req: Request): Promise<Record<string, unknown>> {
    return this.profiles.getMe(req.authUser!);
  }

  @Patch('me')
  patchMe(@Req() req: Request, @Body() body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.profiles.patchMe(req.authUser!, body);
  }
}
