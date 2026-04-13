import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SalaryExpenseKind } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { SalaryExpensesService } from './salary-expenses.service';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

class CreateSalaryExpenseDto {
  @IsUUID()
  profileId!: string;

  @IsString()
  date!: string;

  @IsString()
  price!: string;

  @IsString()
  qty!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsString()
  currency!: string;

  @IsEnum(SalaryExpenseKind)
  kind!: SalaryExpenseKind;

  @IsOptional()
  @IsUUID()
  lessonUuid?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  studentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  groupId?: number;
}

class PatchSalaryExpenseDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @IsString()
  qty?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(SalaryExpenseKind)
  kind?: SalaryExpenseKind;

  @IsOptional()
  @IsUUID()
  lessonUuid?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  studentId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  groupId?: number | null;
}

@Controller('salary-expenses')
@UseGuards(JwtAuthGuard, StaffGuard)
export class SalaryExpensesController {
  constructor(private readonly svc: SalaryExpensesService) {}

  @Get()
  list(
    @Query('profileId') profileId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.svc.list({ profileId, dateFrom, dateTo, limit, cursor });
  }

  @Get(':expenseId')
  getOne(@Param('expenseId') expenseId: string) {
    return this.svc.getOne(expenseId);
  }

  @Post()
  create(@Body() body: CreateSalaryExpenseDto) {
    return this.svc.create(body);
  }

  @Patch(':expenseId')
  patch(@Param('expenseId') expenseId: string, @Body() body: PatchSalaryExpenseDto) {
    return this.svc.patch(expenseId, body);
  }
}
