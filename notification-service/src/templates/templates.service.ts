import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContextUser } from '../shared/auth.types';
import { decodeCursor, encodeCursor, clampLimit } from '../shared/pagination';
import { notificationHttpException } from '../shared/notification-http.exception';
import { isStaffUser } from '../shared/staff.util';
import type { CreateTemplateDto } from './dto/create-template.dto';
import type { UpdateTemplateDto } from './dto/update-template.dto';

function assertStaff(user: AuthContextUser): void {
  if (!isStaffUser(user)) {
    throw notificationHttpException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Staff only', {});
  }
}

function assertSafeHtml(html: string): void {
  if (/<script\b/i.test(html)) {
    throw notificationHttpException(
      HttpStatus.BAD_REQUEST,
      'NOTIFICATION_TEMPLATE_INVALID_BODY',
      'HTML contains forbidden script tags',
      {},
    );
  }
}

function toTemplateJson(row: {
  machineName: string;
  title: string;
  visible: boolean;
  help: string;
  settingsTitle: string | null;
  bodyHtml: string;
  createdAt: Date;
  updatedAt: Date;
  templateGroups?: { group: { machineName: string } }[];
}): Record<string, unknown> {
  return {
    machineName: row.machineName,
    title: row.title,
    visible: row.visible,
    help: row.help,
    settingsTitle: row.settingsTitle,
    bodyHtml: row.bodyHtml,
    groupMachineNames: row.templateGroups?.map((tg) => tg.group.machineName) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthContextUser,
    limitRaw: string | undefined,
    cursor: string | undefined,
    visibleRaw: string | undefined,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    assertStaff(user);
    const limit = clampLimit(limitRaw);
    const where: Prisma.NotificationTemplateWhereInput = { deletedAt: null };
    if (visibleRaw === 'true') {
      where.visible = true;
    } else if (visibleRaw === 'false') {
      where.visible = false;
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
    const rows = await this.prisma.notificationTemplate.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { templateGroups: { include: { group: true } } },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return { data: page.map((r) => toTemplateJson(r)), meta: { nextCursor, limit } };
  }

  async create(user: AuthContextUser, dto: CreateTemplateDto): Promise<Record<string, unknown>> {
    assertStaff(user);
    assertSafeHtml(dto.bodyHtml);
    const exists = await this.prisma.notificationTemplate.findUnique({
      where: { machineName: dto.machineName },
    });
    if (exists && !exists.deletedAt) {
      throw notificationHttpException(
        HttpStatus.CONFLICT,
        'NOTIFICATION_CONFLICT',
        'Template machineName already exists',
        { machineName: dto.machineName },
      );
    }
    const groupLinks = await this.resolveGroupIds(dto.groupMachineNames);
    const row = exists?.deletedAt
      ? await this.prisma.$transaction(async (tx) => {
          await tx.templateGroup.deleteMany({ where: { templateId: exists.id } });
          return tx.notificationTemplate.update({
            where: { id: exists.id },
            data: {
              deletedAt: null,
              title: dto.title,
              visible: dto.visible ?? true,
              help: dto.help ?? '',
              settingsTitle: dto.settingsTitle ?? null,
              bodyHtml: dto.bodyHtml,
              templateGroups: { create: groupLinks.map((groupId) => ({ groupId })) },
            },
            include: { templateGroups: { include: { group: true } } },
          });
        })
      : await this.prisma.notificationTemplate.create({
          data: {
            machineName: dto.machineName,
            title: dto.title,
            visible: dto.visible ?? true,
            help: dto.help ?? '',
            settingsTitle: dto.settingsTitle ?? null,
            bodyHtml: dto.bodyHtml,
            templateGroups: { create: groupLinks.map((groupId) => ({ groupId })) },
          },
          include: { templateGroups: { include: { group: true } } },
        });
    return toTemplateJson(row);
  }

  async getByMachineName(user: AuthContextUser, machineName: string): Promise<Record<string, unknown>> {
    assertStaff(user);
    const row = await this.prisma.notificationTemplate.findFirst({
      where: { machineName, deletedAt: null },
      include: { templateGroups: { include: { group: true } } },
    });
    if (!row) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Template not found', {
        machineName,
      });
    }
    return toTemplateJson(row);
  }

  async update(
    user: AuthContextUser,
    machineName: string,
    dto: UpdateTemplateDto,
  ): Promise<Record<string, unknown>> {
    assertStaff(user);
    const existing = await this.prisma.notificationTemplate.findFirst({
      where: { machineName, deletedAt: null },
    });
    if (!existing) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Template not found', {
        machineName,
      });
    }
    if (dto.bodyHtml !== undefined) {
      assertSafeHtml(dto.bodyHtml);
    }
    const data: Prisma.NotificationTemplateUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.visible !== undefined) {
      data.visible = dto.visible;
    }
    if (dto.help !== undefined) {
      data.help = dto.help;
    }
    if (dto.settingsTitle !== undefined) {
      data.settingsTitle = dto.settingsTitle;
    }
    if (dto.bodyHtml !== undefined) {
      data.bodyHtml = dto.bodyHtml;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.notificationTemplate.update({ where: { id: existing.id }, data });
      if (dto.groupMachineNames !== undefined) {
        await tx.templateGroup.deleteMany({ where: { templateId: existing.id } });
        const groupLinks = await this.resolveGroupIds(dto.groupMachineNames, tx);
        await tx.templateGroup.createMany({
          data: groupLinks.map((groupId) => ({ templateId: existing.id, groupId })),
        });
      }
    });
    return this.getByMachineName(user, machineName);
  }

  async softDelete(user: AuthContextUser, machineName: string): Promise<void> {
    assertStaff(user);
    const existing = await this.prisma.notificationTemplate.findFirst({
      where: { machineName, deletedAt: null },
    });
    if (!existing) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Template not found', {
        machineName,
      });
    }
    await this.prisma.notificationTemplate.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  private async resolveGroupIds(
    names: string[] | undefined,
    tx?: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  ): Promise<string[]> {
    if (!names || names.length === 0) {
      return [];
    }
    const db = tx ?? this.prisma;
    const groups = await db.notificationGroup.findMany({
      where: { machineName: { in: names } },
    });
    if (groups.length !== names.length) {
      throw notificationHttpException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        'One or more notification groups not found',
        { groupMachineNames: names },
      );
    }
    return groups.map((g) => g.id);
  }
}
