import { Module } from '@nestjs/common';
import { InternalSalaryController } from './internal-salary.controller';
import { InternalSalaryService } from './internal-salary.service';

@Module({
  controllers: [InternalSalaryController],
  providers: [InternalSalaryService],
})
export class InternalSalaryModule {}
