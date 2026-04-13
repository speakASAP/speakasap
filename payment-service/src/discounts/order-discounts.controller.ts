import { Body, Controller, Delete, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { DiscountsService } from './discounts.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderDiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Post(':orderId/discounts/apply')
  async apply(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Body() dto: ApplyDiscountDto,
  ): Promise<unknown> {
    return this.discounts.applyToOrder(req.authUser!, orderId, dto);
  }

  @Delete(':orderId/discounts')
  async remove(@Req() req: Request, @Param('orderId') orderId: string): Promise<unknown> {
    return this.discounts.removeFromOrder(req.authUser!, orderId);
  }
}
