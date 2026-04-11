import { Module } from '@nestjs/common';
import { AdminLanguageTestsController } from './admin-language-tests.controller';
import { AdminLanguageUserTestsController } from './admin-language-user-tests.controller';
import { LanguageUserTestsController } from './language-user-tests.controller';
import { AdminLanguageTestsService } from './admin-language-tests.service';
import { LanguageUserTestsService } from './language-user-tests.service';

@Module({
  controllers: [
    AdminLanguageTestsController,
    AdminLanguageUserTestsController,
    LanguageUserTestsController,
  ],
  providers: [AdminLanguageTestsService, LanguageUserTestsService],
})
export class LanguageTestsModule {}
