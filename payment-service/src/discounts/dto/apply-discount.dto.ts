import { IsString, Matches, MaxLength } from 'class-validator';

export class ApplyDiscountDto {
  @IsString()
  @Matches(/^[A-Z0-9_-]{1,64}$/)
  @MaxLength(64)
  code!: string;
}
