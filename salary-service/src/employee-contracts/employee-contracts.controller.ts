import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { EmployeeContractsService } from './employee-contracts.service';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

class CreateContractDto {
  @Type(() => Number)
  @IsNumber()
  legacyPortalUserId!: number;

  @IsOptional()
  @IsUUID()
  profileId?: string;

  @IsOptional()
  @IsString()
  validFrom?: string | null;

  @IsOptional()
  @IsString()
  validTill?: string | null;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsUUID()
  mainContractId?: string | null;

  @IsOptional()
  @IsString()
  contractUid?: string | null;

  @IsOptional()
  @IsString()
  documentStorageKey?: string | null;
}

class PatchContractDto {
  @IsOptional()
  @IsString()
  validFrom?: string | null;

  @IsOptional()
  @IsString()
  validTill?: string | null;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsUUID()
  mainContractId?: string | null;

  @IsOptional()
  @IsString()
  contractUid?: string | null;

  @IsOptional()
  @IsString()
  documentStorageKey?: string | null;
}

@Controller('contracts')
@UseGuards(JwtAuthGuard, StaffGuard)
export class EmployeeContractsController {
  constructor(private readonly svc: EmployeeContractsService) {}

  @Get()
  list(
    @Query('legacyPortalUserId') legacyPortalUserId?: string,
    @Query('profileId') profileId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.svc.list({ legacyPortalUserId, profileId, limit, cursor });
  }

  @Get(':contractId')
  getOne(@Param('contractId') contractId: string) {
    return this.svc.getOne(contractId);
  }

  @Post()
  create(@Body() body: CreateContractDto) {
    return this.svc.create(body);
  }

  @Patch(':contractId')
  patch(@Param('contractId') contractId: string, @Body() body: PatchContractDto) {
    return this.svc.patch(contractId, body);
  }
}
