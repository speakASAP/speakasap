import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AuthClientModule } from './auth-client/auth-client.module';
import { DiscountsModule } from './discounts/discounts.module';
import { InvoicesModule } from './invoices/invoices.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsMsModule } from './payments-ms/payments-ms.module';
import { PrismaModule } from './prisma/prisma.module';
import { SalaryDisburseModule } from './salary-disburse/salary-disburse.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { RequestContextMiddleware } from './shared/request-context.middleware';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    AuthClientModule,
    PaymentsMsModule,
    SalaryDisburseModule,
    OrdersModule,
    DiscountsModule,
    SubscriptionsModule,
    InvoicesModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
