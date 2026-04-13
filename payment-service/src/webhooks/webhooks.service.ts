import { createHmac, timingSafeEqual } from 'crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request } from 'express';
import { paymentHttpException } from '../shared/payment-http.exception';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handlePaymentsWebhook(req: Request): Promise<Record<string, unknown>> {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw paymentHttpException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Raw body required for webhook verification',
      );
    }

    const sig = req.headers['x-webhook-signature'];
    const sigStr = Array.isArray(sig) ? sig[0] : sig;
    if (!this.verifySignature(raw, sigStr)) {
      throw paymentHttpException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Invalid webhook signature');
    }

    const tsHeader = req.headers['x-webhook-timestamp'];
    const tsStr = Array.isArray(tsHeader) ? tsHeader[0] : tsHeader;
    if (tsStr && !this.verifyTimestampSkew(tsStr)) {
      throw paymentHttpException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Webhook timestamp outside allowed window');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch {
      throw paymentHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid JSON body');
    }

    const dto = plainToInstance(PaymentWebhookDto, parsed);
    const errors = await validate(dto);
    if (errors.length > 0) {
      throw paymentHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Webhook payload validation failed', {
        validation: errors.map((e) => ({ property: e.property, constraints: e.constraints })),
      });
    }

    const occurredAt = new Date(dto.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw paymentHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid occurredAt');
    }

    const amountMinor = Math.round(dto.amount * 100);

    try {
      await this.prisma.webhookEvent.create({
        data: {
          eventId: dto.eventId,
          paymentId: dto.paymentId,
          orderId: dto.orderId ?? null,
          status: dto.status,
          amountMinor,
          currency: dto.currency,
          occurredAt,
          rawRef: dto.rawRef ?? null,
        },
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'P2002') {
        this.logger.log(`${new Date().toISOString()} webhook duplicate eventId=${dto.eventId}`);
        return { ok: true, duplicate: true };
      }
      throw e;
    }

    await this.applyPaymentOutcome(dto.paymentId, dto.orderId ?? null, dto.status);

    return { ok: true };
  }

  private async applyPaymentOutcome(
    paymentId: string,
    orderId: string | null,
    status: string,
  ): Promise<void> {
    const paid = this.isPaidStatus(status);
    const failed = this.isFailedStatus(status);

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { providerPaymentId: paymentId },
    });
    const resolvedOrderId = orderId ?? attempt?.orderId ?? null;

    await this.prisma.paymentAttempt.updateMany({
      where: { providerPaymentId: paymentId },
      data: {
        status: paid ? 'completed' : failed ? 'failed' : status.toLowerCase(),
        ...(paid ? { paidAt: new Date() } : {}),
      },
    });

    if (paid && resolvedOrderId) {
      await this.prisma.order.updateMany({
        where: { id: resolvedOrderId },
        data: { paid: true, status: OrderStatus.paid },
      });
    }
  }

  private isPaidStatus(status: string): boolean {
    const s = status.toLowerCase();
    return s === 'completed' || s === 'paid' || s === 'succeeded';
  }

  private isFailedStatus(status: string): boolean {
    const s = status.toLowerCase();
    return s === 'failed' || s === 'cancelled' || s === 'canceled';
  }

  private verifySignature(raw: Buffer, header: string | undefined): boolean {
    const secret = process.env.PAYMENTS_WEBHOOK_SHARED_SECRET;
    if (!secret || !header) {
      return false;
    }
    const m = /^sha256=([a-f0-9]+)$/i.exec(header.trim());
    if (!m) {
      return false;
    }
    const expectedHex = createHmac('sha256', secret).update(raw).digest('hex');
    const gotHex = m[1].toLowerCase();
    try {
      const a = Buffer.from(gotHex, 'hex');
      const b = Buffer.from(expectedHex, 'hex');
      if (a.length !== b.length) {
        return false;
      }
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private verifyTimestampSkew(header: string): boolean {
    const sec = Number(header);
    if (!Number.isFinite(sec)) {
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return Math.abs(now - sec) <= 300;
  }
}
