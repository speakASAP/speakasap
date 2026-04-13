import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { ExpensesController } from './expenses.controller';
import { FinancialAggregationService } from './financial-aggregation.service';
import { FinancialQueryService } from './financial-query.service';
import { InternalFinancialController } from './internal-financial.controller';
import { RevenueController } from './revenue.controller';

@Module({
  controllers: [RevenueController, ExpensesController, DashboardController, InternalFinancialController],
  providers: [FinancialQueryService, FinancialAggregationService],
})
export class FinancialModule {}
