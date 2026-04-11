import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';
import { TeacherQuestsController } from './teacher-quests.controller';

@Module({
  imports: [AuthModule],
  controllers: [QuestsController, TeacherQuestsController],
  providers: [QuestsService],
})
export class QuestsModule {}
