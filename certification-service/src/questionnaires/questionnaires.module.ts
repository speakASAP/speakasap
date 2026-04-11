import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ManagerQuestionnairesController } from './manager-questionnaires.controller';
import { QuestionnairesCatalogController } from './questionnaires-catalog.controller';
import { QuestionnairesService } from './questionnaires.service';
import { UserQuestionnairesController } from './user-questionnaires.controller';

@Module({
  imports: [AuthModule],
  controllers: [QuestionnairesCatalogController, UserQuestionnairesController, ManagerQuestionnairesController],
  providers: [QuestionnairesService],
})
export class QuestionnairesModule {}
