import { Module } from '@nestjs/common';
import { EmployeeProfilesController } from './employee-profiles.controller';
import { EmployeeProfilesService } from './employee-profiles.service';

@Module({
  controllers: [EmployeeProfilesController],
  providers: [EmployeeProfilesService],
})
export class EmployeeProfilesModule {}
