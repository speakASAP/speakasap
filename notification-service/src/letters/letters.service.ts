import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContextUser } from '../shared/auth.types';
import { decodeCursor, encodeCursor, clampLimit } from '../shared/pagination';
import { notificationHttpException } from '../shared/notification-http.exception';
import { isStaffUser } from '../shared/staff.util';

@Injectable()
export class LettersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthContextUser,
    limitRaw: string | undefined,
    cursor: string | undefined,
    filterUserId: string | undefined,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    const limit = clampLimit(limitRaw);
    const where: Prisma.LetterWhereInput = {};
    if (isStaffUser(user)) {
      if (filterUserId) {
        where.userId = filterUserId;
      }
    } else {
      where.userId = user.id;
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
    const rows = await this.prisma.letter.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { template: { select: { machineName: true, title: true } } },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return {
      data: page.map((r) => ({
        id: r.id,
        templateMachineName: r.template.machineName,
        userId: r.userId,
        recipients: r.recipients,
        sentAt: r.sentAt?.toISOString() ?? null,
        transportError: r.transportError,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { nextCursor, limit },
    };
  }

  async getOne(user: AuthContextUser, id: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.letter.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!row) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Letter not found', { id });
    }
    if (!isStaffUser(user) && row.userId !== user.id) {
      throw notificationHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Forbidden', {});
    }
    return {
      id: row.id,
      templateMachineName: row.template.machineName,
      userId: row.userId,
      renderedBody: row.renderedBody,
      renderedBodySha256: row.renderedBodySha256,
      recipients: row.recipients,
      fromEmail: row.fromEmail,
      sentAt: row.sentAt?.toISOString() ?? null,
      transportError: row.transportError,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
