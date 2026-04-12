import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthClientModule } from './auth-client/auth-client.module';
import { CategoriesModule } from './categories/categories.module';
import { OffersModule } from './offers/offers.module';
import { PartPaymentCollectionsModule } from './part-payment-collections/part-payment-collections.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { RequestContextMiddleware } from './shared/request-context.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    AuthClientModule,
    CategoriesModule,
    ProductsModule,
    PartPaymentCollectionsModule,
    OffersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
