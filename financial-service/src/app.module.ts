import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthClientModule } from './auth-client/auth-client.module';
import { DepsModule } from './deps/deps.module';
import { FinancialModule } from './financial/financial.module';
import { PrismaModule } from './prisma/prisma.module';
import { RequestContextMiddleware } from './shared/request-context.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PrismaModule, AuthClientModule, DepsModule, FinancialModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
