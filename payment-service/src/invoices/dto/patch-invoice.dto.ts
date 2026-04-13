import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class PatchInvoiceDto {
  @IsOptional()
  @IsBoolean()
  received?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
