import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { LessonClientModule } from '../lesson-client/lesson-client.module';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [AuthClientModule, LessonClientModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
