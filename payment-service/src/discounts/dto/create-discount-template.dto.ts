import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateDiscountTemplateDto {
  @IsString()
  @Matches(/^[A-Z0-9_-]{1,64}$/)
  code!: string;

  @IsOptional()
  @IsBoolean()
  singleUser?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  discount!: number;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validTill?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  permanent?: boolean;

  @IsOptional()
  @IsBoolean()
  courseDiscount?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  productIds?: string[];
}
