import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthContextUser } from '../shared/auth.types';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('visible') visible?: string,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    return this.templates.list(req.authUser as AuthContextUser, limit, cursor, visible);
  }

  @Post()
  create(@Req() req: Request, @Body() body: CreateTemplateDto): Promise<Record<string, unknown>> {
    return this.templates.create(req.authUser as AuthContextUser, body);
  }

  @Get(':machineName')
  getOne(
    @Req() req: Request,
    @Param('machineName') machineName: string,
  ): Promise<Record<string, unknown>> {
    return this.templates.getByMachineName(req.authUser as AuthContextUser, decodeParam(machineName));
  }

  @Patch(':machineName')
  update(
    @Req() req: Request,
    @Param('machineName') machineName: string,
    @Body() body: UpdateTemplateDto,
  ): Promise<Record<string, unknown>> {
    return this.templates.update(req.authUser as AuthContextUser, decodeParam(machineName), body);
  }

  @Delete(':machineName')
  async remove(@Req() req: Request, @Param('machineName') machineName: string): Promise<void> {
    await this.templates.softDelete(req.authUser as AuthContextUser, decodeParam(machineName));
  }
}

function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
