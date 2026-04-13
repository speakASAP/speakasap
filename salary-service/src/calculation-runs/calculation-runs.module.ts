import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { CalculationRunsController } from './calculation-runs.controller';
import { CalculationRunsService } from './calculation-runs.service';

@Module({
  controllers: [CalculationRunsController],
  providers: [CalculationRunsService, JwtAuthGuard, StaffGuard],
})
export class CalculationRunsModule {}
