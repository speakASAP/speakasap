import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { PayoutRunsController } from './payout-runs.controller';
import { PayoutRunsService } from './payout-runs.service';

@Module({
  controllers: [PayoutRunsController],
  providers: [PayoutRunsService, JwtAuthGuard, StaffGuard],
})
export class PayoutRunsModule {}
