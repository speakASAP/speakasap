import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthContextUser } from '../shared/auth.types';
import { PatchEmailPreferenceDto } from './dto/patch-email-pref.dto';
import { PatchTemplatePreferenceDto } from './dto/patch-template-pref.dto';
import { PreferencesService } from './preferences.service';

@Controller('preferences/me')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get('email')
  getEmail(@Req() req: Request): Promise<{ emailEnabled: boolean }> {
    return this.preferences.getMyEmail(req.authUser as AuthContextUser);
  }

  @Patch('email')
  patchEmail(
    @Req() req: Request,
    @Body() body: PatchEmailPreferenceDto,
  ): Promise<{ emailEnabled: boolean }> {
    return this.preferences.patchMyEmail(req.authUser as AuthContextUser, body);
  }

  @Get('templates')
  listTemplates(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    return this.preferences.listMyTemplates(req.authUser as AuthContextUser, limit, cursor);
  }

  @Patch('templates/:machineName')
  patchTemplate(
    @Req() req: Request,
    @Param('machineName') machineName: string,
    @Body() body: PatchTemplatePreferenceDto,
  ): Promise<{ machineName: string; active: boolean; title: string }> {
    return this.preferences.patchMyTemplatePref(req.authUser as AuthContextUser, decode(machineName), body);
  }
}

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
