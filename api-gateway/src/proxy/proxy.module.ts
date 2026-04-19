import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { GatewayAuthGuard } from './gateway-auth.guard';
import { GatewayProxyController } from './gateway-proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  imports: [AuthClientModule],
  controllers: [GatewayProxyController],
  providers: [ProxyService, GatewayAuthGuard],
})
export class ProxyModule {}
