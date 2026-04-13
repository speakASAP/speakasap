import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class PaymentWebhookDto {
  @IsString()
  @MaxLength(256)
  eventId!: string;

  @IsString()
  @MaxLength(128)
  paymentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @IsString()
  @MaxLength(64)
  status!: string;

  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @IsString()
  @MaxLength(8)
  currency!: string;

  @IsString()
  @MaxLength(64)
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  rawRef?: string;
}
