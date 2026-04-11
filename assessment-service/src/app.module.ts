import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RequestContextMiddleware } from './shared/request-context.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LanguageTestsModule } from './language-tests/language-tests.module';
import { AssetUserTestsModule } from './asset-user-tests/asset-user-tests.module';

@Module({
  imports: [PrismaModule, AuthModule, LanguageTestsModule, AssetUserTestsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
