import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GrammarModule } from './grammar/grammar.module';
import { PhoneticsModule } from './phonetics/phonetics.module';
import { DictionaryModule } from './dictionary/dictionary.module';
import { SongsModule } from './songs/songs.module';
import { LanguagesModule } from './languages/languages.module';
import { RequestContextMiddleware } from './shared/request-context.middleware';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [SharedModule, GrammarModule, PhoneticsModule, DictionaryModule, SongsModule, LanguagesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
