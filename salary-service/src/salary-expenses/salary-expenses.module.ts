import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { SalaryExpensesController } from './salary-expenses.controller';
import { SalaryExpensesService } from './salary-expenses.service';

@Module({
  controllers: [SalaryExpensesController],
  providers: [SalaryExpensesService, JwtAuthGuard, StaffGuard],
})
export class SalaryExpensesModule {}
