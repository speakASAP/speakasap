import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { AdminSummaryController } from './admin-summary.controller';
import { AdminSummaryService } from './admin-summary.service';

@Module({
  controllers: [AdminSummaryController],
  providers: [AdminSummaryService, JwtAuthGuard, StaffGuard],
})
export class AdminModule {}
