import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentCoursesController } from './student-courses.controller';
import { StudentCoursesService } from './student-courses.service';

@Module({
  imports: [PrismaModule, AuthClientModule],
  controllers: [StudentCoursesController],
  providers: [StudentCoursesService],
})
export class StudentCoursesModule {}
