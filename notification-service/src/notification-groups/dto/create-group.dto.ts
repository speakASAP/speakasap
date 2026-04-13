import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateNotificationGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  machineName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  title!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(500)
  @Type(() => String)
  managerUserIds?: string[];
}
