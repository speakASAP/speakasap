import { IsIn, IsObject, IsOptional } from 'class-validator';

export class PatchOrderDto {
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['cancel_draft'])
  action?: 'cancel_draft';
}
