import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DispatchEmailGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  templateMachineName!: string;

  @IsObject()
  context!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsBoolean()
  respectPreferences?: boolean;

  @IsOptional()
  @IsBoolean()
  respectDoNotContact?: boolean;
}
