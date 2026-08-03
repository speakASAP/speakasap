import { Injectable, Logger } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsTransportService } from '../notifications-ms/notifications-transport.service';
import { UserLookupService } from '../user-lookup/user-lookup.service';
import { canonicalJson } from '../shared/canonical-json';
import { notificationHttpException } from '../shared/notification-http.exception';
import { renderTemplateHtml } from '../shared/template-render';
import { drillRendererFor } from '../templates/drills/renderers';
import type { DispatchEmailDto } from './dto/dispatch-email.dto';
import type { DispatchEmailGroupDto } from './dto/dispatch-email-group.dto';
import { logOperationalFailure } from '../shared/operational-log';

const IDEMPOTENCY_TTL_MS = 86400000;

export type IdempotentReplay = { statusCode: number; body: Record<string, unknown> };

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transport: NotificationsTransportService,
    private readonly userLookup: UserLookupService,
  ) {}

  /**
   * Produces the email body, and a subject when the renderer owns one.
   *
   * Most templates are a `bodyHtml` row rendered with `{{key}}` substitution. The two
   * drill templates are not: their bodies carry arrays (the topic list, the sentences a
   * student struggled with), and `renderTemplateHtml` collapses any non-scalar to an
   * empty string, so a seeded row would email a body with those parts silently missing.
   * For those machine names the body comes from code instead, and the row supplies only
   * the title, visibility and preference wiring the rest of dispatch needs.
   *
   * The subject is returned separately because a code-rendered template also owns its
   * localized subject line, which the row's single `title` cannot express per recipient.
   */
  private renderBody(
    templateMachineName: string,
    bodyHtml: string,
    ctx: Record<string, unknown>,
  ): { html: string; subject: string | null } {
    const renderer = drillRendererFor(templateMachineName);
    if (!renderer) {
      return { html: renderTemplateHtml(bodyHtml, ctx), subject: null };
    }
    const rendered = renderer(ctx);
    return { html: rendered.html, subject: rendered.subject };
  }

  async pruneIdempotency(): Promise<void> {
    await this.prisma.dispatchIdempotency.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  async replayIfNeeded(
    idempotencyKey: string | undefined,
    body: unknown,
  ): Promise<IdempotentReplay | null> {
    if (!idempotencyKey || idempotencyKey.length > 128) {
      return null;
    }
    await this.pruneIdempotency();
    const bodyHash = sha256(canonicalJson(body));
    const row = await this.prisma.dispatchIdempotency.findUnique({
      where: { idempotencyKey },
    });
    if (!row) {
      return null;
    }
    if (row.bodyHash !== bodyHash) {
      throw notificationHttpException(
        HttpStatus.CONFLICT,
        'NOTIFICATION_CONFLICT',
        'Idempotency-Key reused with different body',
        {},
      );
    }
    return { statusCode: row.statusCode, body: row.responseBody as Record<string, unknown> };
  }

  async storeIdempotency(
    idempotencyKey: string | undefined,
    body: unknown,
    statusCode: number,
    responseBody: Record<string, unknown>,
  ): Promise<void> {
    if (!idempotencyKey || idempotencyKey.length > 128) {
      return;
    }
    const bodyHash = sha256(canonicalJson(body));
    await this.prisma.dispatchIdempotency.create({
      data: {
        idempotencyKey,
        bodyHash,
        statusCode,
        responseBody: responseBody as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      },
    });
  }

  async dispatchEmailSingle(dto: DispatchEmailDto): Promise<Record<string, unknown>> {
    const respectPreferences = dto.respectPreferences !== false;
    const respectDoNotContact = dto.respectDoNotContact !== false;

    if (!dto.userId && !dto.recipient) {
      throw notificationHttpException(
        HttpStatus.BAD_REQUEST,
        'NOTIFICATION_VALIDATION_FAILED',
        'Provide userId and/or recipient',
        {},
      );
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: { machineName: dto.templateMachineName, deletedAt: null },
    });
    if (!template) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Template not found', {
        templateMachineName: dto.templateMachineName,
      });
    }

    let mailbox: string | null = null;
    const prefsUserId = dto.userId;

    if (dto.recipient && dto.recipient.trim()) {
      if (!isValidEmail(dto.recipient.trim())) {
        throw notificationHttpException(
          HttpStatus.BAD_REQUEST,
          'NOTIFICATION_VALIDATION_FAILED',
          'Invalid recipient email',
          {},
        );
      }
      mailbox = dto.recipient.trim();
    }

    let lookupDnc = false;
    if (dto.userId) {
      const needEmail = !mailbox;
      const target = await this.userLookup.resolveNotificationTarget(dto.userId, needEmail);
      lookupDnc = target.doNotContact;
      if (!mailbox) {
        mailbox = target.email;
      }
    }

    if (!mailbox || !isValidEmail(mailbox)) {
      throw notificationHttpException(
        HttpStatus.BAD_REQUEST,
        'NOTIFICATION_VALIDATION_FAILED',
        'Could not resolve a valid mailbox',
        {},
      );
    }

    if (respectDoNotContact && dto.userId && lookupDnc) {
      throw notificationHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'NOTIFICATION_PREFERENCE_BLOCKED',
        'User opted out of contact',
        { reason: 'DO_NOT_CONTACT' },
      );
    }

    if (respectPreferences && prefsUserId && template.visible) {
      const common = await this.prisma.commonEmailSettings.findUnique({
        where: { userId: prefsUserId },
      });
      if (common && !common.emailEnabled) {
        throw notificationHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'NOTIFICATION_PREFERENCE_BLOCKED',
          'User disabled email',
          {},
        );
      }
      const pref = await this.prisma.templatePreference.findUnique({
        where: { userId_templateId: { userId: prefsUserId, templateId: template.id } },
      });
      const active = pref?.active ?? true;
      if (!active) {
        throw notificationHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'NOTIFICATION_PREFERENCE_BLOCKED',
          'User disabled this template',
          {},
        );
      }
    }

    const ctx: Record<string, unknown> = { ...(dto.context ?? {}) };
    if (dto.userId) {
      ctx.userId = dto.userId;
    }
    const body = this.renderBody(dto.templateMachineName, template.bodyHtml, ctx);
    const rendered = body.html;
    const renderedHash = sha256(rendered);

    const letter = await this.prisma.letter.create({
      data: {
        templateId: template.id,
        userId: dto.userId ?? null,
        renderedBody: rendered,
        renderedBodySha256: renderedHash,
        recipients: [mailbox],
        fromEmail: null,
      },
    });

    // An explicit subject from the caller still wins; the renderer's localized subject
    // only stands in for the row's single-language title.
    const subject = dto.subject?.trim() || body.subject || template.title;

    try {
      await this.transport.sendEmail({
        recipient: mailbox,
        subject,
        message: rendered,
        attachments: dto.attachments,
        templateData: ctx,
      });
    } catch (e) {
      await this.prisma.letter.update({
        where: { id: letter.id },
        data: {
          transportError: (e as Error).message?.slice(0, 4000) ?? 'transport_error',
        },
      });
      throw e;
    }

    await this.prisma.letter.update({
      where: { id: letter.id },
      data: { sentAt: new Date() },
    });

    return {
      dispatchRequestId: letter.id,
      recipient: mailbox,
      sentAt: new Date().toISOString(),
    };
  }

  async dispatchEmailGroup(dto: DispatchEmailGroupDto): Promise<Record<string, unknown>> {
    const respectPreferences = dto.respectPreferences !== false;
    const respectDoNotContact = dto.respectDoNotContact !== false;

    const template = await this.prisma.notificationTemplate.findFirst({
      where: { machineName: dto.templateMachineName, deletedAt: null },
      include: {
        templateGroups: {
          include: { group: { include: { managers: true } } },
        },
      },
    });
    if (!template) {
      throw notificationHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Template not found', {
        templateMachineName: dto.templateMachineName,
      });
    }
    if (template.templateGroups.length === 0) {
      throw notificationHttpException(
        HttpStatus.BAD_REQUEST,
        'NOTIFICATION_VALIDATION_FAILED',
        'Template has no notification groups',
        {},
      );
    }

    const managerIds = new Set<string>();
    for (const tg of template.templateGroups) {
      for (const m of tg.group.managers) {
        managerIds.add(m.managerUserId);
      }
    }
    if (managerIds.size === 0) {
      throw notificationHttpException(
        HttpStatus.BAD_REQUEST,
        'NOTIFICATION_VALIDATION_FAILED',
        'No managers in template groups',
        {},
      );
    }

    const ctx: Record<string, unknown> = { ...dto.context };
    if (dto.actorUserId) {
      ctx.actorUserId = dto.actorUserId;
    }
    const body = this.renderBody(dto.templateMachineName, template.bodyHtml, ctx);
    const rendered = body.html;
    const renderedHash = sha256(rendered);
    const subject = body.subject || template.title;

    const results: { dispatchRequestId: string; recipient: string; sentAt: string }[] = [];

    for (const managerUserId of managerIds) {
      const target = await this.userLookup.resolveNotificationTarget(managerUserId, true);
      const mailbox = target.email;
      if (!mailbox || !isValidEmail(mailbox)) {
        continue;
      }
      if (respectDoNotContact && target.doNotContact) {
        continue;
      }
      if (respectPreferences && template.visible) {
        const common = await this.prisma.commonEmailSettings.findUnique({
          where: { userId: managerUserId },
        });
        if (common && !common.emailEnabled) {
          continue;
        }
        const pref = await this.prisma.templatePreference.findUnique({
          where: { userId_templateId: { userId: managerUserId, templateId: template.id } },
        });
        if ((pref?.active ?? true) === false) {
          continue;
        }
      }

      const letter = await this.prisma.letter.create({
        data: {
          templateId: template.id,
          userId: dto.actorUserId ?? null,
          renderedBody: rendered,
          renderedBodySha256: renderedHash,
          recipients: [mailbox],
          fromEmail: null,
        },
      });
      try {
        await this.transport.sendEmail({
          recipient: mailbox,
          subject,
          message: rendered,
          templateData: ctx,
        });
      } catch (e) {
        await this.prisma.letter.update({
          where: { id: letter.id },
          data: { transportError: (e as Error).message?.slice(0, 4000) ?? 'transport_error' },
        });
        throw e;
      }
      const sentAt = new Date();
      await this.prisma.letter.update({
        where: { id: letter.id },
        data: { sentAt },
      });
      results.push({
        dispatchRequestId: letter.id,
        recipient: mailbox,
        sentAt: sentAt.toISOString(),
      });
    }

    if (results.length === 0) {
      logOperationalFailure(this.logger, {
        component: 'dispatch',
        operation: 'POST /dispatch/email/group',
        errorCode: 'NOTIFICATION_GROUP_DISPATCH_EMPTY',
        message: 'No manager emails sent (all skipped, blocked, or unresolved)',
        templateMachineName: dto.templateMachineName,
        managerCount: String(managerIds.size),
      });
    }

    return { results };
  }
}
