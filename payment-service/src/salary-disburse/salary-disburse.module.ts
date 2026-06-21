import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SalaryDisburseController } from './salary-disburse.controller';
import { SalaryDisburseService } from './salary-disburse.service';

@Module({
  imports: [PrismaModule],
  controllers: [SalaryDisburseController],
  providers: [SalaryDisburseService],
})
export class SalaryDisburseModule {}
