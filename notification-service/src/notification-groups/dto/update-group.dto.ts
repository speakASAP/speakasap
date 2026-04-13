import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateNotificationGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(500)
  @Type(() => String)
  managerUserIds?: string[];
}
