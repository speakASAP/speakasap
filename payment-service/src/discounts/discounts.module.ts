import { Module } from '@nestjs/common';
import { DiscountTemplatesController } from './discount-templates.controller';
import { OrderDiscountsController } from './order-discounts.controller';
import { DiscountsService } from './discounts.service';

@Module({
  controllers: [DiscountTemplatesController, OrderDiscountsController],
  providers: [DiscountsService],
})
export class DiscountsModule {}
