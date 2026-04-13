import { Global, Module } from '@nestjs/common';
import { PaymentsMsClient } from './payments-ms.client';

@Global()
@Module({
  providers: [PaymentsMsClient],
  exports: [PaymentsMsClient],
})
export class PaymentsMsModule {}
