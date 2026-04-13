import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { FinancialQueryService } from './financial-query.service';

@Controller('revenue')
@UseGuards(JwtAuthGuard, StaffGuard)
export class RevenueController {
  constructor(private readonly query: FinancialQueryService) {}

  @Get('category-matrix')
  categoryMatrix(@Query('monthFrom') monthFrom: string, @Query('monthTo') monthTo: string) {
    return this.query.categoryMatrix(monthFrom, monthTo);
  }

  @Get('by-payment-method')
  byPaymentMethod(@Query('month') month: string) {
    return this.query.revenueByPaymentMethod(month);
  }

  @Get('summary')
  summary(@Query('monthFrom') monthFrom: string, @Query('monthTo') monthTo: string) {
    return this.query.revenueSummary(monthFrom, monthTo);
  }
}
