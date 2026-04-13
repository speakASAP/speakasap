import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const PAYMENTS_MS_METHODS = [
  'paypal',
  'stripe',
  'payu',
  'fiobanka',
  'comgate',
  'card',
  'webpay',
  'inner',
  'invoice',
] as const;

export class PayCustomerDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;
}

export class PayOrderDto {
  @IsString()
  @IsIn(PAYMENTS_MS_METHODS as unknown as string[])
  paymentMethod!: string;

  @ValidateNested()
  @Type(() => PayCustomerDto)
  customer!: PayCustomerDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
