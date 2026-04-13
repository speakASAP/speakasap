import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  priceMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  productId?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Date)
  tillDate?: Date;
}
