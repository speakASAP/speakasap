import { createHash } from 'crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Order } from '@prisma/client';
import { OrderStatus, Prisma } from '@prisma/client';
import type { AuthContextUser } from '../shared/auth.types';
import { clampLimit, decodeCursor, encodeCursor } from '../shared/pagination';
import { paymentHttpException } from '../shared/payment-http.exception';
import { isAdmin } from '../shared/roles';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsMsClient } from '../payments-ms/payments-ms.client';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { PatchOrderDto } from './dto/patch-order.dto';
import type { PayOrderDto } from './dto/pay-order.dto';
import { effectiveOrderStatus, toOrderDto, type OrderWithRelations } from './order.mapper';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsMs: PaymentsMsClient,
  ) {}

  private hashCreateBody(userId: string, dto: CreateOrderDto): string {
    const payload = JSON.stringify({
      userId,
      title: dto.title,
      priceMinor: dto.priceMinor,
      currency: dto.currency ?? null,
      productId: dto.productId ?? null,
      data: dto.data ?? null,
      tillDate: dto.tillDate ? new Date(dto.tillDate).toISOString().slice(0, 10) : null,
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  async createOrder(
    user: AuthContextUser,
    dto: CreateOrderDto,
    idempotencyKey: string | undefined,
  ): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const hash = this.hashCreateBody(user.id, dto);
    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });
      if (existing) {
        if (existing.bodyHash !== hash) {
          throw paymentHttpException(
            HttpStatus.CONFLICT,
            'CONFLICT',
            'Idempotency-Key reused with a different request body',
          );
        }
        return {
          statusCode: existing.httpStatus,
          body: existing.responseJson as Record<string, unknown>,
        };
      }
    }

    const currency = dto.currency?.toUpperCase() || 'EUR';
    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        title: dto.title,
        priceMinor: dto.priceMinor,
        currency,
        paid: false,
        status: OrderStatus.draft,
        productId: dto.productId ?? null,
        data: (dto.data ?? {}) as Prisma.InputJsonValue,
        tillDate: dto.tillDate ? new Date(dto.tillDate) : null,
      },
      include: { discountOrder: true, paymentAttempts: true },
    });

    const body = {
      data: toOrderDto(order as OrderWithRelations),
      meta: { nextCursor: null as string | null, limit: 1 },
    };
    const statusCode = HttpStatus.CREATED;

    if (idempotencyKey) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await this.prisma.idempotencyRecord
        .create({
          data: {
            key: idempotencyKey,
            bodyHash: hash,
            responseJson: JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue,
            httpStatus: statusCode,
            expiresAt,
          },
        })
        .catch((err) => {
          this.logger.warn(`${new Date().toISOString()} idempotency insert skipped ${String(err)}`);
        });
    }

    return { statusCode, body };
  }

  async listOrders(
    user: AuthContextUser,
    limitRaw: string | undefined,
    cursor: string | undefined,
    filterUserId: string | undefined,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    const limit = clampLimit(limitRaw);
    const where: Prisma.OrderWhereInput = {};
    if (isAdmin(user)) {
      if (filterUserId) {
        where.userId = filterUserId;
      }
    } else {
      where.userId = user.id;
    }
    where.trashedAt = null;

    const cur = decodeCursor(cursor);
    if (cur) {
      const d = new Date(cur.c);
      where.AND = [
        {
          OR: [{ createdAt: { lt: d } }, { AND: [{ createdAt: d }, { id: { lt: cur.i } }] }],
        },
      ];
    }

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { discountOrder: true, paymentAttempts: true },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    return {
      data: page.map((o) => toOrderDto(o as OrderWithRelations)),
      meta: { nextCursor, limit },
    };
  }

  async getOrder(user: AuthContextUser, orderId: string): Promise<Record<string, unknown>> {
    const order = await this.loadOrderOrThrow(orderId);
    this.assertCanAccess(user, order);
    const synced = await this.syncExpired(order);
    const full = await this.prisma.order.findUniqueOrThrow({
      where: { id: synced.id },
      include: { discountOrder: true, paymentAttempts: true },
    });
    return toOrderDto(full as OrderWithRelations);
  }

  async patchOrder(
    user: AuthContextUser,
    orderId: string,
    dto: PatchOrderDto,
  ): Promise<Record<string, unknown>> {
    const order = await this.loadOrderOrThrow(orderId);
    this.assertOwner(user, order);
    if (dto.action === 'cancel_draft') {
      if (order.status !== OrderStatus.draft) {
        throw paymentHttpException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          'Only draft orders can be canceled this way',
        );
      }
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.canceled, paid: false },
      });
    }
    if (dto.data) {
      const nextData = { ...(order.data as object), ...dto.data } as Prisma.InputJsonValue;
      await this.prisma.order.update({
        where: { id: order.id },
        data: { data: nextData },
      });
    }
    const full = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { discountOrder: true, paymentAttempts: true },
    });
    return toOrderDto(full as OrderWithRelations);
  }

  async payOrder(
    user: AuthContextUser,
    orderId: string,
    dto: PayOrderDto,
  ): Promise<Record<string, unknown>> {
    const order = await this.loadOrderOrThrow(orderId);
    this.assertOwner(user, order);
    const synced = await this.syncExpired(order);
    const effective = effectiveOrderStatus(synced);
    if (
      effective === OrderStatus.paid ||
      effective === OrderStatus.canceled ||
      effective === OrderStatus.expired
    ) {
      throw paymentHttpException(
        HttpStatus.CONFLICT,
        'PAYMENT_ORDER_INVALID_STATE',
        'Order is not payable in its current state',
      );
    }

    const applicationId = process.env.PAYMENT_APPLICATION_ID || '';
    const callbackUrl = process.env.PAYMENTS_CHECKOUT_CALLBACK_URL || '';
    const amount = Number((order.priceMinor / 100).toFixed(2));
    if (amount < 0.01) {
      throw paymentHttpException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Order amount too small for checkout',
      );
    }

    const started = Date.now();
    const ms = await this.paymentsMs.createPayment({
      orderId: order.id,
      applicationId,
      amount,
      currency: order.currency,
      paymentMethod: dto.paymentMethod,
      callbackUrl,
      description: dto.description,
      customer: {
        email: dto.customer.email,
        name: dto.customer.name,
        phone: dto.customer.phone,
      },
      metadata: dto.metadata,
    });
    this.logger.log(
      `${new Date().toISOString()} payments-ms createPayment done duration_ms=${Date.now() - started}`,
    );

    await this.prisma.paymentAttempt.create({
      data: {
        orderId: order.id,
        amountMinor: order.priceMinor,
        method: dto.paymentMethod,
        status: 'processing',
        providerPaymentId: ms.paymentId,
        providerPayload: { redirectUrl: ms.redirectUrl } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.awaiting_payment },
    });

    const full = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { discountOrder: true, paymentAttempts: true },
    });

    return {
      order: toOrderDto(full as OrderWithRelations),
      provider: {
        paymentId: ms.paymentId,
        status: ms.status,
        redirectUrl: ms.redirectUrl,
      },
    };
  }

  async markPaid(user: AuthContextUser, orderId: string): Promise<Record<string, unknown>> {
    if (!isAdmin(user)) {
      throw paymentHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Admin role required');
    }
    const order = await this.loadOrderOrThrow(orderId);
    await this.prisma.order.update({
      where: { id: order.id },
      data: { paid: true, status: OrderStatus.paid },
    });
    const full = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { discountOrder: true, paymentAttempts: true },
    });
    return toOrderDto(full as OrderWithRelations);
  }

  private async loadOrderOrThrow(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.trashedAt) {
      throw paymentHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Order not found');
    }
    return order;
  }

  private assertCanAccess(user: AuthContextUser, order: { userId: string }): void {
    if (order.userId === user.id) {
      return;
    }
    if (isAdmin(user)) {
      return;
    }
    throw paymentHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not allowed to access this order');
  }

  private assertOwner(user: AuthContextUser, order: { userId: string }): void {
    if (order.userId !== user.id) {
      throw paymentHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not allowed to modify this order');
    }
  }

  private async syncExpired(order: Order): Promise<Order> {
    if (order.paid || order.status === OrderStatus.canceled) {
      return order;
    }
    if (order.tillDate) {
      const end = new Date(order.tillDate);
      end.setUTCHours(23, 59, 59, 999);
      if (Date.now() > end.getTime() && order.status !== OrderStatus.expired) {
        return this.prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.expired },
        });
      }
    }
    return order;
  }
}
