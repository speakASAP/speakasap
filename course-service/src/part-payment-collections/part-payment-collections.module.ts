import { Module } from '@nestjs/common';
import { PartPaymentCollectionsController } from './part-payment-collections.controller';
import { PartPaymentCollectionsService } from './part-payment-collections.service';

@Module({
  controllers: [PartPaymentCollectionsController],
  providers: [PartPaymentCollectionsService],
})
export class PartPaymentCollectionsModule {}
