import { Global, Module } from '@nestjs/common';
import { EducationClientService } from './education-client.service';
import { PaymentClientService } from './payment-client.service';

@Global()
@Module({
  providers: [EducationClientService, PaymentClientService],
  exports: [EducationClientService, PaymentClientService],
})
export class DepsModule {}
