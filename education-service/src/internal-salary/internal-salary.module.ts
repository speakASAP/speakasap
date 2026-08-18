import { Module } from '@nestjs/common';
import { InternalSalaryController } from './internal-salary.controller';
import { InternalSalaryService } from './internal-salary.service';
import { LessonClientModule } from '../lesson-client/lesson-client.module';

@Module({
  imports: [LessonClientModule],
  controllers: [InternalSalaryController],
  providers: [InternalSalaryService],
})
export class InternalSalaryModule {}
