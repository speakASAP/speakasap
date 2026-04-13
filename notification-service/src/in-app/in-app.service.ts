import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContextUser } from '../shared/auth.types';
import { decodeCursor, encodeCursor, clampLimit } from '../shared/pagination';
import { notificationHttpException } from '../shared/notification-http.exception';

@Injectable()
export class InAppService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthContextUser,
    limitRaw: string | undefined,
    cursor: string | undefined,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    const limit = clampLimit(limitRaw);
    const where: Prisma.InAppNotificationWhereInput = { userId: user.id };
    const cur = decodeCursor(cursor);
    if (cur) {
      const d = new Date(cur.c);
      where.AND = [
        {
          OR: [{ createdAt: { lt: d } }, { AND: [{ createdAt: d }, { id: { lt: cur.i } }] }],
        },
      ];
    }
    const rows = await this.prisma.inAppNotification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return {
      data: page.map((r) => ({
        id: r.id,
        text: r.text,
        link: r.link,
        read: r.read,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { nextCursor, limit },
    };
  }

  async markRead(user: AuthContextUser, id: string): Promise<{ id: string; read: boolean }> {
    const row = await this.prisma.inAppNotification.findFirst({ where: { id, userId: user.id } });
    if (!row) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Notification not found', { id });
    }
    await this.prisma.inAppNotification.update({ where: { id }, data: { read: true } });
    return { id, read: true };
  }

  async markAllRead(user: AuthContextUser): Promise<{ updated: number }> {
    const res = await this.prisma.inAppNotification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return { updated: res.count };
  }
}
