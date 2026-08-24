import { Global, Module } from '@nestjs/common';
import { AuthClientService } from './auth-client.service';
import { TeacherRoleClientService } from './teacher-role-client.service';

@Global()
@Module({
  providers: [AuthClientService, TeacherRoleClientService],
  exports: [AuthClientService, TeacherRoleClientService],
})
export class AuthClientModule {}
