import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [JwtAuthGuard, InternalApiKeyGuard, RolesGuard],
  exports: [JwtAuthGuard, InternalApiKeyGuard, RolesGuard],
})
export class AuthModule {}
