import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { PatchOrderDto } from './dto/patch-order.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('userId') userId?: string,
  ): Promise<unknown> {
    return this.orders.listOrders(req.authUser!, limit, cursor, userId);
  }

  @Post()
  async create(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idem?: string,
  ): Promise<unknown> {
    const key = idem?.trim() || undefined;
    const { statusCode, body } = await this.orders.createOrder(req.authUser!, dto, key);
    res.status(statusCode);
    return body;
  }

  @Get(':orderId')
  async get(@Req() req: Request, @Param('orderId') orderId: string): Promise<unknown> {
    return this.orders.getOrder(req.authUser!, orderId);
  }

  @Patch(':orderId')
  async patch(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Body() dto: PatchOrderDto,
  ): Promise<unknown> {
    return this.orders.patchOrder(req.authUser!, orderId, dto);
  }

  @Post(':orderId/pay')
  @HttpCode(200)
  async pay(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Body() dto: PayOrderDto,
  ): Promise<unknown> {
    return this.orders.payOrder(req.authUser!, orderId, dto);
  }

  @Post(':orderId/mark-paid')
  @HttpCode(200)
  async markPaid(@Req() req: Request, @Param('orderId') orderId: string): Promise<unknown> {
    return this.orders.markPaid(req.authUser!, orderId);
  }
}
