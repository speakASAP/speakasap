import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class DispatchEmailDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  templateMachineName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(998)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  recipient?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  attachments?: string[];

  @IsOptional()
  @IsString()
  cc?: string;

  @IsOptional()
  @IsBoolean()
  respectPreferences?: boolean;

  @IsOptional()
  @IsBoolean()
  respectDoNotContact?: boolean;
}
