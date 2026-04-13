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
import { CreateNotificationGroupDto } from './dto/create-group.dto';
import { UpdateNotificationGroupDto } from './dto/update-group.dto';
import { NotificationGroupsService } from './notification-groups.service';

@Controller('notification-groups')
@UseGuards(JwtAuthGuard)
export class NotificationGroupsController {
  constructor(private readonly groups: NotificationGroupsService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    return this.groups.list(req.authUser as AuthContextUser, limit, cursor);
  }

  @Post()
  create(
    @Req() req: Request,
    @Body() body: CreateNotificationGroupDto,
  ): Promise<Record<string, unknown>> {
    return this.groups.create(req.authUser as AuthContextUser, body);
  }

  @Get(':machineName')
  getOne(@Req() req: Request, @Param('machineName') machineName: string): Promise<Record<string, unknown>> {
    return this.groups.getOne(req.authUser as AuthContextUser, decode(machineName));
  }

  @Patch(':machineName')
  update(
    @Req() req: Request,
    @Param('machineName') machineName: string,
    @Body() body: UpdateNotificationGroupDto,
  ): Promise<Record<string, unknown>> {
    return this.groups.update(req.authUser as AuthContextUser, decode(machineName), body);
  }

  @Delete(':machineName')
  async remove(@Req() req: Request, @Param('machineName') machineName: string): Promise<void> {
    await this.groups.remove(req.authUser as AuthContextUser, decode(machineName));
  }
}

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
