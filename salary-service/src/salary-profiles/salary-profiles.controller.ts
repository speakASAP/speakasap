import { Controller, Get, Param, Patch, Query, Req, UseGuards, Body } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { SalaryProfilesService } from './salary-profiles.service';
import { IsBoolean, IsNumberString, IsOptional, IsString, IsIn } from 'class-validator';

class PatchSalaryProfileDto {
  @IsOptional()
  @IsString()
  @IsIn(['EUR', 'CZK', 'RUB'])
  currency?: string;

  @IsOptional()
  @IsString()
  preferablePm?: string | null;

  @IsOptional()
  @IsNumberString()
  salary?: string;

  @IsOptional()
  @IsNumberString()
  rate?: string;

  @IsOptional()
  @IsBoolean()
  showAsTeacher?: boolean;

  @IsOptional()
  @IsBoolean()
  showAsOther?: boolean;
}

@Controller('salary-profiles')
@UseGuards(JwtAuthGuard, StaffGuard)
export class SalaryProfilesController {
  constructor(private readonly svc: SalaryProfilesService) {}

  @Get()
  list(
    @Req() _req: Request,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('filter') filter?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.svc.list({ dateFrom, dateTo, filter, limit, cursor });
  }

  @Get(':profileId')
  getOne(@Param('profileId') profileId: string) {
    return this.svc.getOne(profileId);
  }

  @Patch(':profileId')
  patch(@Param('profileId') profileId: string, @Body() body: PatchSalaryProfileDto) {
    return this.svc.patch(profileId, body);
  }
}
