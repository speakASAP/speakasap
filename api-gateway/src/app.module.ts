import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { ProxyModule } from './proxy/proxy.module';
import { GatewayProxyController } from './proxy/gateway-proxy.controller';
import { RateLimitMiddleware } from './proxy/rate-limit.middleware';
import { RequestContextMiddleware } from './shared/request-context.middleware';

@Module({
  imports: [ProxyModule],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
    consumer.apply(RateLimitMiddleware).forRoutes(GatewayProxyController);
  }
}
