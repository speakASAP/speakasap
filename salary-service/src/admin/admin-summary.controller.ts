import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { AdminSummaryService } from './admin-summary.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('admin/summary')
@UseGuards(JwtAuthGuard, StaffGuard)
export class AdminSummaryController {
  constructor(private readonly svc: AdminSummaryService) {}

  @Get('by-profile')
  byProfile(@Query('dateFrom') dateFrom: string, @Query('dateTo') dateTo: string) {
    if (!dateFrom || !dateTo || !DATE_RE.test(dateFrom) || !DATE_RE.test(dateTo)) {
      throw new BadRequestException('dateFrom and dateTo are required (YYYY-MM-DD)');
    }
    return this.svc.summaryByProfile(dateFrom, dateTo);
  }

  @Get('months')
  months() {
    return this.svc.summaryMonths();
  }
}
