import { Global, Module } from '@nestjs/common';
import { PaymentClientService } from './payment-client.service';
import { SalaryClientService } from './salary-client.service';
import { CourseClientService } from './course-client.service';

@Global()
@Module({
  providers: [PaymentClientService, SalaryClientService, CourseClientService],
  exports: [PaymentClientService, SalaryClientService, CourseClientService],
})
export class DepsModule {}
