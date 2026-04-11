import { Global, Module } from '@nestjs/common';
import { AuthClientService } from './auth-client.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt.guard';
import { StaffRolesGuard } from './staff-roles.guard';
import { ManagerRolesGuard } from './manager-roles.guard';

@Global()
@Module({
  providers: [
    AuthClientService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    StaffRolesGuard,
    ManagerRolesGuard,
  ],
  exports: [
    AuthClientService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    StaffRolesGuard,
    ManagerRolesGuard,
  ],
})
export class AuthModule {}
