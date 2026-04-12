import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthClientModule } from './auth-client/auth-client.module';
import { EmployeeProfilesModule } from './employee-profiles/employee-profiles.module';
import { InternalModule } from './internal/internal.module';
import { ManagersModule } from './managers/managers.module';
import { PrismaModule } from './prisma/prisma.module';
import { RequestContextMiddleware } from './shared/request-context.middleware';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    AuthClientModule,
    StudentsModule,
    TeachersModule,
    ManagersModule,
    EmployeeProfilesModule,
    InternalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
