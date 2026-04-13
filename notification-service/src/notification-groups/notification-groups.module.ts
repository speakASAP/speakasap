import { Module } from '@nestjs/common';
import { NotificationGroupsController } from './notification-groups.controller';
import { NotificationGroupsService } from './notification-groups.service';

@Module({
  controllers: [NotificationGroupsController],
  providers: [NotificationGroupsService],
})
export class NotificationGroupsModule {}
