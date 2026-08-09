import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { HomeworksController } from './homeworks.controller';
import { HomeworksService } from './homeworks.service';

@Module({
  imports: [AuthClientModule],
  controllers: [HomeworksController],
  providers: [HomeworksService],
})
export class HomeworksModule {}
