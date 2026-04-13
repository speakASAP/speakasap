import { Module } from '@nestjs/common';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';
import { NotificationsMsModule } from '../notifications-ms/notifications-ms.module';

@Module({
  imports: [NotificationsMsModule],
  controllers: [DispatchController],
  providers: [DispatchService],
})
export class DispatchModule {}
