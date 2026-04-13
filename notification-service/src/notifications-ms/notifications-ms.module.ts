import { Module } from '@nestjs/common';
import { NotificationsTransportService } from './notifications-transport.service';

@Module({
  providers: [NotificationsTransportService],
  exports: [NotificationsTransportService],
})
export class NotificationsMsModule {}
