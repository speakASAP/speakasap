import { Module } from '@nestjs/common';
import { AuthClientService } from './auth-client.service';

@Module({
  providers: [AuthClientService],
  exports: [AuthClientService],
})
export class AuthClientModule {}
