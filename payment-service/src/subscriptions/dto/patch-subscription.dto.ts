import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsObject, IsOptional } from 'class-validator';
import { SubscriptionBillingStatus } from '@prisma/client';

export class PatchSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionBillingStatus)
  status?: SubscriptionBillingStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  currentPeriodEnd?: Date;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
