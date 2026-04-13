import { IsBoolean } from 'class-validator';

export class PatchEmailPreferenceDto {
  @IsBoolean()
  emailEnabled!: boolean;
}
