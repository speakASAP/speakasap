import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CertificatesModule } from './certificates/certificates.module';
import { QuestionnairesModule } from './questionnaires/questionnaires.module';
import { QuestsModule } from './quests/quests.module';
import { RequestContextMiddleware } from './shared/request-context.middleware';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [SharedModule, AuthModule, CertificatesModule, QuestsModule, QuestionnairesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
