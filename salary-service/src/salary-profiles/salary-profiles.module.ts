import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { SalaryProfilesController } from './salary-profiles.controller';
import { SalaryProfilesService } from './salary-profiles.service';

@Module({
  controllers: [SalaryProfilesController],
  providers: [SalaryProfilesService, JwtAuthGuard, StaffGuard],
})
export class SalaryProfilesModule {}
