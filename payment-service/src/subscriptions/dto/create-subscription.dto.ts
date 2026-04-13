import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SubscriptionBillingStatus } from '@prisma/client';

export class CreateSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @IsOptional()
  @IsEnum(SubscriptionBillingStatus)
  status?: SubscriptionBillingStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  currentPeriodEnd?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentsMicroserviceCustomerId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
