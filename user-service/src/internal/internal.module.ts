import { Module } from '@nestjs/common';
import { ManagersModule } from '../managers/managers.module';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [StudentsModule, TeachersModule, ManagersModule],
  controllers: [InternalController],
})
export class InternalModule {}
