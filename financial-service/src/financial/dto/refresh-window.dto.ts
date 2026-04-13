import { IsString, Matches } from 'class-validator';
import { MONTH_RE } from '../../shared/months';

export class RefreshWindowDto {
  @IsString()
  @Matches(MONTH_RE)
  monthFrom!: string;

  @IsString()
  @Matches(MONTH_RE)
  monthTo!: string;
}
