import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContextUser } from '../shared/auth.types';
import { decodeCursor, encodeCursor, clampLimit } from '../shared/pagination';
import { notificationHttpException } from '../shared/notification-http.exception';
import { isStaffUser } from '../shared/staff.util';
import type { CreateNotificationGroupDto } from './dto/create-group.dto';
import type { UpdateNotificationGroupDto } from './dto/update-group.dto';

function assertStaff(user: AuthContextUser): void {
  if (!isStaffUser(user)) {
    throw notificationHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Staff only', {});
  }
}

function toGroupJson(row: {
  machineName: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  managers: { managerUserId: string }[];
}): Record<string, unknown> {
  return {
    machineName: row.machineName,
    title: row.title,
    managerUserIds: row.managers.map((m) => m.managerUserId),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class NotificationGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthContextUser,
    limitRaw: string | undefined,
    cursor: string | undefined,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    assertStaff(user);
    const limit = clampLimit(limitRaw);
    const where: Prisma.NotificationGroupWhereInput = {};
    const cur = decodeCursor(cursor);
    if (cur) {
      const d = new Date(cur.c);
      where.AND = [
        {
          OR: [{ createdAt: { lt: d } }, { AND: [{ createdAt: d }, { id: { lt: cur.i } }] }],
        },
      ];
    }
    const rows = await this.prisma.notificationGroup.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { managers: true },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return { data: page.map((r) => toGroupJson(r)), meta: { nextCursor, limit } };
  }

  async create(user: AuthContextUser, dto: CreateNotificationGroupDto): Promise<Record<string, unknown>> {
    assertStaff(user);
    try {
      const row = await this.prisma.notificationGroup.create({
        data: {
          machineName: dto.machineName,
          title: dto.title,
          managers: {
            create: (dto.managerUserIds ?? []).map((managerUserId) => ({ managerUserId })),
          },
        },
        include: { managers: true },
      });
      return toGroupJson(row);
    } catch {
      throw notificationHttpException(
        HttpStatus.CONFLICT,
        'NOTIFICATION_CONFLICT',
        'Group machineName already exists',
        { machineName: dto.machineName },
      );
    }
  }

  async getOne(user: AuthContextUser, machineName: string): Promise<Record<string, unknown>> {
    assertStaff(user);
    const row = await this.prisma.notificationGroup.findUnique({
      where: { machineName },
      include: { managers: true },
    });
    if (!row) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Group not found', {
        machineName,
      });
    }
    return toGroupJson(row);
  }

  async update(
    user: AuthContextUser,
    machineName: string,
    dto: UpdateNotificationGroupDto,
  ): Promise<Record<string, unknown>> {
    assertStaff(user);
    const existing = await this.prisma.notificationGroup.findUnique({ where: { machineName } });
    if (!existing) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Group not found', {
        machineName,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.NotificationGroupUpdateInput = {};
      if (dto.title !== undefined) {
        data.title = dto.title;
      }
      await tx.notificationGroup.update({ where: { id: existing.id }, data });
      if (dto.managerUserIds !== undefined) {
        await tx.notificationGroupManager.deleteMany({ where: { groupId: existing.id } });
        await tx.notificationGroupManager.createMany({
          data: dto.managerUserIds.map((managerUserId) => ({ groupId: existing.id, managerUserId })),
        });
      }
    });
    return this.getOne(user, machineName);
  }

  async remove(user: AuthContextUser, machineName: string): Promise<void> {
    assertStaff(user);
    const existing = await this.prisma.notificationGroup.findUnique({
      where: { machineName },
      include: { templateGroups: true },
    });
    if (!existing) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Group not found', {
        machineName,
      });
    }
    if (existing.templateGroups.length > 0) {
      throw notificationHttpException(
        HttpStatus.CONFLICT,
        'NOTIFICATION_CONFLICT',
        'Group is still linked to templates',
        { machineName },
      );
    }
    await this.prisma.notificationGroup.delete({ where: { id: existing.id } });
  }
}
