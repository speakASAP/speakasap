import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContextUser } from '../shared/auth.types';
import { decodeCursor, encodeCursor, clampLimit } from '../shared/pagination';
import { notificationHttpException } from '../shared/notification-http.exception';
import type { PatchEmailPreferenceDto } from './dto/patch-email-pref.dto';
import type { PatchTemplatePreferenceDto } from './dto/patch-template-pref.dto';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyEmail(user: AuthContextUser): Promise<{ emailEnabled: boolean }> {
    const row = await this.prisma.commonEmailSettings.findUnique({ where: { userId: user.id } });
    return { emailEnabled: row?.emailEnabled ?? true };
  }

  async patchMyEmail(user: AuthContextUser, dto: PatchEmailPreferenceDto): Promise<{ emailEnabled: boolean }> {
    await this.prisma.commonEmailSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, emailEnabled: dto.emailEnabled, doNotContact: false },
      update: { emailEnabled: dto.emailEnabled },
    });
    return { emailEnabled: dto.emailEnabled };
  }

  async listMyTemplates(
    user: AuthContextUser,
    limitRaw: string | undefined,
    cursor: string | undefined,
  ): Promise<{ data: unknown[]; meta: { nextCursor: string | null; limit: number } }> {
    const limit = clampLimit(limitRaw);
    const where: Prisma.NotificationTemplateWhereInput = { visible: true, deletedAt: null };
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
    });
    const prefs = await this.prisma.templatePreference.findMany({
      where: { userId: user.id, templateId: { in: rows.map((t) => t.id) } },
    });
    const prefByTemplate = new Map(prefs.map((p) => [p.templateId, p.active]));
    const data = rows.map((t) => ({
      machineName: t.machineName,
      active: prefByTemplate.has(t.id) ? prefByTemplate.get(t.id)! : true,
      title: t.title,
      createdAt: t.createdAt,
      id: t.id,
    }));
    const hasMore = data.length > limit;
    const page = hasMore ? data.slice(0, limit) : data;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return {
      data: page.map(({ machineName, active, title }) => ({ machineName, active, title })),
      meta: { nextCursor, limit },
    };
  }

  async patchMyTemplatePref(
    user: AuthContextUser,
    machineName: string,
    dto: PatchTemplatePreferenceDto,
  ): Promise<{ machineName: string; active: boolean; title: string }> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { machineName, visible: true, deletedAt: null },
    });
    if (!template) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Template not found', {
        machineName,
      });
    }
    await this.prisma.templatePreference.upsert({
      where: { userId_templateId: { userId: user.id, templateId: template.id } },
      create: { userId: user.id, templateId: template.id, active: dto.active },
      update: { active: dto.active },
    });
    return { machineName, active: dto.active, title: template.title };
  }
}
