import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [AuthClientModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
