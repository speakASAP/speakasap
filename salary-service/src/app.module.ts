import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthClientModule } from './auth-client/auth-client.module';
import { PrismaModule } from './prisma/prisma.module';
import { DepsModule } from './deps/deps.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { SalaryProfilesModule } from './salary-profiles/salary-profiles.module';
import { SalaryExpensesModule } from './salary-expenses/salary-expenses.module';
import { EmployeeContractsModule } from './employee-contracts/employee-contracts.module';
import { CalculationRunsModule } from './calculation-runs/calculation-runs.module';
import { PayoutRunsModule } from './payout-runs/payout-runs.module';
import { AdminModule } from './admin/admin.module';
import { RequestContextMiddleware } from './shared/request-context.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    AuthClientModule,
    DepsModule,
    IdempotencyModule,
    SalaryProfilesModule,
    SalaryExpensesModule,
    EmployeeContractsModule,
    CalculationRunsModule,
    PayoutRunsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
