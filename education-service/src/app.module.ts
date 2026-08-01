import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthClientModule } from './auth-client/auth-client.module';
import { DrillsModule } from './drills/drills.module';
import { GroupsModule } from './groups/groups.module';
import { HomeworksModule } from './homeworks/homeworks.module';
import { InternalSalaryModule } from './internal-salary/internal-salary.module';
import { LessonRecordsModule } from './lesson-records/lesson-records.module';
import { LessonsModule } from './lessons/lessons.module';
import { PrismaModule } from './prisma/prisma.module';
import { StudentCoursesModule } from './student-courses/student-courses.module';
import { RequestContextMiddleware } from './shared/request-context.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    AuthClientModule,
    GroupsModule,
    StudentCoursesModule,
    LessonsModule,
    LessonRecordsModule,
    HomeworksModule,
    DrillsModule,
    InternalSalaryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
