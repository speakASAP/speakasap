import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { CalculationRunsService } from './calculation-runs.service';
import { IsArray, IsNumber, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

class UnfinalizeCalculationRunDto {
  /** Required: an un-finalized payroll run must say why on the record. */
  @IsString()
  @MinLength(3)
  reason!: string;
}

class CreateCalculationRunDto {
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  profileIds?: number[];

  @IsString()
  rulesVersion!: string;
}

@Controller('calculation-runs')
@UseGuards(JwtAuthGuard, StaffGuard)
export class CalculationRunsController {
  constructor(private readonly svc: CalculationRunsService) {}

  @Post()
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateCalculationRunDto,
  ) {
    return this.svc.create(body, idempotencyKey?.trim() || undefined);
  }

  @Get()
  list(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.svc.list({ limit, cursor });
  }

  @Get(':runId')
  getOne(@Param('runId') runId: string) {
    return this.svc.getOne(runId);
  }

  @Post(':runId/finalize')
  finalize(@Param('runId') runId: string) {
    return this.svc.finalize(runId);
  }

  /**
   * Return a finalized run to draft. Refused once any payout run references it.
   * The run and its lines are kept — this reopens for correction, it does not erase.
   */
  @Post(':runId/unfinalize')
  unfinalize(@Param('runId') runId: string, @Body() body: UnfinalizeCalculationRunDto) {
    return this.svc.unfinalize(runId, body.reason);
  }
}
