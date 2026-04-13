import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { EmployeeContractsController } from './employee-contracts.controller';
import { EmployeeContractsService } from './employee-contracts.service';

@Module({
  controllers: [EmployeeContractsController],
  providers: [EmployeeContractsService, JwtAuthGuard, StaffGuard],
})
export class EmployeeContractsModule {}
