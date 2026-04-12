import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HomeworksController } from './homeworks.controller';
import { HomeworksService } from './homeworks.service';

@Module({
  imports: [PrismaModule, AuthClientModule],
  controllers: [HomeworksController],
  providers: [HomeworksService],
})
export class HomeworksModule {}
