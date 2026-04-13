import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { FinancialQueryService } from './financial-query.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, StaffGuard)
export class DashboardController {
  constructor(private readonly query: FinancialQueryService) {}

  @Get('overview')
  overview(@Query('month') month: string) {
    return this.query.dashboardOverview(month);
  }
}
