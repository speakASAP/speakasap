import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { StudentCoursesController } from './student-courses.controller';
import { StudentCoursesService } from './student-courses.service';

@Module({
  imports: [AuthClientModule],
  controllers: [StudentCoursesController],
  providers: [StudentCoursesService],
})
export class StudentCoursesModule {}
