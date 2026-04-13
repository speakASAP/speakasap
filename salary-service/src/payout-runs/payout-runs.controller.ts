import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { PayoutRunsService } from './payout-runs.service';
import { IsUUID } from 'class-validator';

class CreatePayoutRunDto {
  @IsUUID()
  calculationRunId!: string;
}

@Controller('payout-runs')
@UseGuards(JwtAuthGuard, StaffGuard)
export class PayoutRunsController {
  constructor(private readonly svc: PayoutRunsService) {}

  @Post()
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreatePayoutRunDto,
  ) {
    return this.svc.create(body, idempotencyKey?.trim() || undefined);
  }

  @Get()
  list(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.svc.list({ limit, cursor });
  }

  @Get(':payoutRunId')
  getOne(@Param('payoutRunId') payoutRunId: string) {
    return this.svc.getOne(payoutRunId);
  }

  @Post(':payoutRunId/commit')
  commit(
    @Param('payoutRunId') payoutRunId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.svc.commit(payoutRunId, idempotencyKey);
  }
}
