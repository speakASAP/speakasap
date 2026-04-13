import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContextUser } from '../shared/auth.types';
import { clampLimit, decodeCursor, encodeCursor } from '../shared/pagination';
import { paymentHttpException } from '../shared/payment-http.exception';
import { isAdmin } from '../shared/roles';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { PatchInvoiceDto } from './dto/patch-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthContextUser,
    limitRaw: string | undefined,
    cursor: string | undefined,
    filterUserId: string | undefined,
    receivedRaw: string | undefined,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    const limit = clampLimit(limitRaw);
    const where: Prisma.InvoiceWhereInput = {};
    if (isAdmin(user)) {
      if (filterUserId) {
        where.userId = filterUserId;
      }
    } else {
      where.userId = user.id;
    }
    if (receivedRaw === 'true') {
      where.received = true;
    } else if (receivedRaw === 'false') {
      where.received = false;
    }
    const cur = decodeCursor(cursor);
    if (cur) {
      const d = new Date(cur.c);
      where.AND = [
        {
          OR: [{ createdAt: { lt: d } }, { AND: [{ createdAt: d }, { id: { lt: cur.i } }] }],
        },
      ];
    }
    const rows = await this.prisma.invoice.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return {
      data: page.map((i) => this.toDto(i)),
      meta: { nextCursor, limit },
    };
  }

  async get(user: AuthContextUser, id: string): Promise<unknown> {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) {
      throw paymentHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Invoice not found');
    }
    if (inv.userId !== user.id && !isAdmin(user)) {
      throw paymentHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not allowed');
    }
    return this.toDto(inv);
  }

  async create(user: AuthContextUser, dto: CreateInvoiceDto): Promise<unknown> {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order || order.trashedAt) {
      throw paymentHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Order not found');
    }
    if (order.userId !== user.id && !isAdmin(user)) {
      throw paymentHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not allowed');
    }
    const amountMinor = dto.amountMinor ?? order.priceMinor;
    const created = await this.prisma.invoice.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        number: dto.number ?? null,
        amountMinor,
        currency: order.currency,
        received: false,
        metadata: {} as Prisma.InputJsonValue,
      },
    });
    return this.toDto(created);
  }

  async patch(user: AuthContextUser, id: string, dto: PatchInvoiceDto): Promise<unknown> {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) {
      throw paymentHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Invoice not found');
    }
    if (inv.userId !== user.id && !isAdmin(user)) {
      throw paymentHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not allowed');
    }
    if (dto.received === undefined && dto.metadata === undefined) {
      throw paymentHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'No updates supplied');
    }
    const meta =
      dto.metadata !== undefined
        ? ({ ...(inv.metadata as object), ...dto.metadata } as Prisma.InputJsonValue)
        : undefined;
    const data: Prisma.InvoiceUpdateInput = {};
    if (dto.received !== undefined) {
      data.received = dto.received;
    }
    if (meta !== undefined) {
      data.metadata = meta;
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data,
    });
    return this.toDto(updated);
  }

  private toDto(i: {
    id: string;
    orderId: string;
    userId: string;
    number: string | null;
    received: boolean;
    amountMinor: number;
    currency: string;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    return {
      id: i.id,
      orderId: i.orderId,
      userId: i.userId,
      number: i.number,
      received: i.received,
      amountMinor: i.amountMinor,
      currency: i.currency,
      metadata: i.metadata,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    };
  }
}
