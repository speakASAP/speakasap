import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @MaxLength(64)
  orderId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  number?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  amountMinor?: number;
}
