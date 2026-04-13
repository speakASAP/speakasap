import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { FinancialQueryService } from './financial-query.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard, StaffGuard)
export class ExpensesController {
  constructor(private readonly query: FinancialQueryService) {}

  @Get('summary')
  summary(@Query('monthFrom') monthFrom: string, @Query('monthTo') monthTo: string) {
    return this.query.expensesSummary(monthFrom, monthTo);
  }

  @Get('operating-lines')
  operatingLines(@Query('cursor') cursor: string | undefined, @Query('limit') limit: string | undefined) {
    return this.query.operatingLines(cursor, limit);
  }
}
