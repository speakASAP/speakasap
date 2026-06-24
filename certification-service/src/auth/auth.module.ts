import { Module } from '@nestjs/common';
import { AuthClientService } from '../auth-client/auth-client.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [AuthClientService, JwtAuthGuard, InternalApiKeyGuard, RolesGuard],
  exports: [AuthClientService, JwtAuthGuard, InternalApiKeyGuard, RolesGuard],
})
export class AuthModule {}
