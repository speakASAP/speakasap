import { IsBoolean } from 'class-validator';

export class PatchTemplatePreferenceDto {
  @IsBoolean()
  active!: boolean;
}
