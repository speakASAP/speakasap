import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContextUser } from '../shared/auth.types';
import { clampLimit, decodeCursor, encodeCursor } from '../shared/pagination';
import { paymentHttpException } from '../shared/payment-http.exception';
import { isAdmin } from '../shared/roles';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSubscriptionDto } from './dto/create-subscription.dto';
import type { PatchSubscriptionDto } from './dto/patch-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthContextUser,
    limitRaw: string | undefined,
    cursor: string | undefined,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    const limit = clampLimit(limitRaw);
    const where: Prisma.SubscriptionWhereInput = { userId: user.id };
    const cur = decodeCursor(cursor);
    if (cur) {
      const d = new Date(cur.c);
      where.AND = [
        {
          OR: [{ createdAt: { lt: d } }, { AND: [{ createdAt: d }, { id: { lt: cur.i } }] }],
        },
      ];
    }
    const rows = await this.prisma.subscription.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return {
      data: page.map((s) => this.toDto(s)),
      meta: { nextCursor, limit },
    };
  }

  async get(user: AuthContextUser, id: string): Promise<unknown> {
    const s = await this.prisma.subscription.findUnique({ where: { id } });
    if (!s) {
      throw paymentHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Subscription not found');
    }
    if (s.userId !== user.id && !isAdmin(user)) {
      throw paymentHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not allowed');
    }
    return this.toDto(s);
  }

  async create(user: AuthContextUser, dto: CreateSubscriptionDto): Promise<unknown> {
    const targetUserId = dto.userId && isAdmin(user) ? dto.userId : user.id;
    if (dto.userId && dto.userId !== user.id && !isAdmin(user)) {
      throw paymentHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Cannot create for another user');
    }
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
      if (!order || order.userId !== targetUserId) {
        throw paymentHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid order for subscription');
      }
    }
    const created = await this.prisma.subscription.create({
      data: {
        userId: targetUserId,
        status: dto.status ?? 'active',
        currentPeriodEnd: dto.currentPeriodEnd ?? null,
        paymentsMicroserviceCustomerId: dto.paymentsMicroserviceCustomerId ?? null,
        orderId: dto.orderId ?? null,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.toDto(created);
  }

  async patch(user: AuthContextUser, id: string, dto: PatchSubscriptionDto): Promise<unknown> {
    const s = await this.prisma.subscription.findUnique({ where: { id } });
    if (!s) {
      throw paymentHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Subscription not found');
    }
    if (s.userId !== user.id && !isAdmin(user)) {
      throw paymentHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not allowed');
    }
    if (dto.status === undefined && dto.currentPeriodEnd === undefined && dto.metadata === undefined) {
      throw paymentHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'No updates supplied');
    }
    const meta =
      dto.metadata !== undefined
        ? ({ ...(s.metadata as object), ...dto.metadata } as Prisma.InputJsonValue)
        : undefined;
    const data: Prisma.SubscriptionUpdateInput = {};
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.currentPeriodEnd !== undefined) {
      data.currentPeriodEnd = dto.currentPeriodEnd;
    }
    if (meta !== undefined) {
      data.metadata = meta;
    }
    const updated = await this.prisma.subscription.update({
      where: { id },
      data,
    });
    return this.toDto(updated);
  }

  private toDto(s: {
    id: string;
    userId: string;
    status: string;
    currentPeriodEnd: Date | null;
    paymentsMicroserviceCustomerId: string | null;
    orderId: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    return {
      id: s.id,
      userId: s.userId,
      status: s.status,
      currentPeriodEnd: s.currentPeriodEnd,
      paymentsMicroserviceCustomerId: s.paymentsMicroserviceCustomerId,
      orderId: s.orderId,
      metadata: s.metadata,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
}
