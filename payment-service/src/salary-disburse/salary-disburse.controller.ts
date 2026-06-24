import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsObject, IsString, Min } from 'class-validator';
import { Public } from '../shared/public.decorator';
import { SalaryDisburseService } from './salary-disburse.service';

class SalaryDisburseDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsInt()
  legacyPortalUserId!: number;

  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsObject()
  metadata!: { salaryPayoutLineId?: string; period?: string };
}

@Public()
@Controller('internal/salary/disburse')
export class SalaryDisburseController {
  constructor(private readonly service: SalaryDisburseService) {}

  @Post()
  create(
    @Headers('x-internal-token') token: string | undefined,
    @Headers('x-service-name') serviceName: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: SalaryDisburseDto,
  ) {
    return this.service.create(token, serviceName, idempotencyKey, body);
  }

  @Get(':payoutRef')
  get(
    @Headers('x-internal-token') token: string | undefined,
    @Headers('x-service-name') serviceName: string | undefined,
    @Param('payoutRef') payoutRef: string,
  ) {
    return this.service.get(token, serviceName, payoutRef);
  }
}
