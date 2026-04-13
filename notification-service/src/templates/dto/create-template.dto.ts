import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  machineName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  title!: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsString()
  help?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  settingsTitle?: string | null;

  @IsString()
  @MinLength(1)
  bodyHtml!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @Type(() => String)
  groupMachineNames?: string[];
}
