import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [PrismaModule, AuthClientModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
