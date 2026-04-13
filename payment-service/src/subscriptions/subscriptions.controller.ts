import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { PatchSubscriptionDto } from './dto/patch-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    return this.subscriptions.list(req.authUser!, limit, cursor);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateSubscriptionDto): Promise<unknown> {
    return this.subscriptions.create(req.authUser!, dto);
  }

  @Get(':subscriptionId')
  async get(@Req() req: Request, @Param('subscriptionId') subscriptionId: string): Promise<unknown> {
    return this.subscriptions.get(req.authUser!, subscriptionId);
  }

  @Patch(':subscriptionId')
  async patch(
    @Req() req: Request,
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: PatchSubscriptionDto,
  ): Promise<unknown> {
    return this.subscriptions.patch(req.authUser!, subscriptionId, dto);
  }
}
