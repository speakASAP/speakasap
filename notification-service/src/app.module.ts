import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AuthClientModule } from './auth-client/auth-client.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { InAppModule } from './in-app/in-app.module';
import { LettersModule } from './letters/letters.module';
import { NotificationGroupsModule } from './notification-groups/notification-groups.module';
import { PreferencesModule } from './preferences/preferences.module';
import { PrismaModule } from './prisma/prisma.module';
import { RequestContextMiddleware } from './shared/request-context.middleware';
import { RequestLoggingInterceptor } from './shared/request-logging.interceptor';
import { UserLookupModule } from './user-lookup/user-lookup.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    PrismaModule,
    AuthClientModule,
    UserLookupModule,
    TemplatesModule,
    NotificationGroupsModule,
    PreferencesModule,
    DispatchModule,
    InAppModule,
    LettersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
