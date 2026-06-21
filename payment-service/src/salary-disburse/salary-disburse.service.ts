import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { paymentHttpException } from '../shared/payment-http.exception';

type SalaryDisburseRequest = {
  idempotencyKey: string;
  legacyPortalUserId: number;
  amountMinor: number;
  currency: string;
  metadata: { salaryPayoutLineId?: string; period?: string };
};

type SalaryDisburseRecord = {
  payoutRef: string;
  status: 'processing';
  legacyPortalUserId: number;
  amountMinor: number;
  currency: string;
  metadata: { salaryPayoutLineId?: string; period?: string };
  createdAt: string;
  provider: 'manual_salary_disbursement';
};

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SalaryDisburseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    token: string | undefined,
    routeIdempotencyKey: string | undefined,
    body: SalaryDisburseRequest,
  ): Promise<{ payoutRef: string; status: 'processing' }> {
    this.assertInternalToken(token);
    const idempotencyKey = routeIdempotencyKey?.trim() || body.idempotencyKey?.trim();
    if (!idempotencyKey) {
      throw paymentHttpException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Idempotency-Key header or idempotencyKey body field is required',
      );
    }
    this.assertBody(body);
    const bodyHash = this.hash({
      legacyPortalUserId: body.legacyPortalUserId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      metadata: body.metadata,
    });
    const key = `salary-disburse:${idempotencyKey}`;
    const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    if (existing) {
      if (existing.bodyHash !== bodyHash) {
        throw paymentHttpException(
          HttpStatus.CONFLICT,
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was already used with a different salary disbursement body',
        );
      }
      const response = existing.responseJson as SalaryDisburseRecord;
      return { payoutRef: response.payoutRef, status: response.status };
    }

    const payoutRef = `salary-${body.metadata.salaryPayoutLineId || this.hash(idempotencyKey).slice(0, 16)}`;
    const record: SalaryDisburseRecord = {
      payoutRef,
      status: 'processing',
      legacyPortalUserId: body.legacyPortalUserId,
      amountMinor: body.amountMinor,
      currency: body.currency.toUpperCase(),
      metadata: body.metadata,
      createdAt: new Date().toISOString(),
      provider: 'manual_salary_disbursement',
    };
    await this.prisma.idempotencyRecord.create({
      data: {
        key,
        bodyHash,
        responseJson: record,
        httpStatus: 202,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
    return { payoutRef, status: record.status };
  }

  async get(token: string | undefined, payoutRef: string): Promise<{ payoutRef: string; status: 'processing' }> {
    this.assertInternalToken(token);
    const rows = await this.prisma.idempotencyRecord.findMany({
      where: {
        key: { startsWith: 'salary-disburse:' },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const match = rows
      .map((row) => row.responseJson as SalaryDisburseRecord)
      .find((row) => row.payoutRef === payoutRef);
    if (!match) {
      throw paymentHttpException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Salary disbursement not found');
    }
    return { payoutRef: match.payoutRef, status: match.status };
  }

  private assertInternalToken(token: string | undefined): void {
    const expected =
      process.env.PAYMENT_SERVICE_INTERNAL_TOKEN ||
      process.env.INTERNAL_API_TOKEN ||
      process.env.PAYMENT_API_KEY ||
      '';
    if (!expected || token !== expected) {
      throw paymentHttpException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Invalid internal token');
    }
  }

  private assertBody(body: SalaryDisburseRequest): void {
    if (!Number.isInteger(body.legacyPortalUserId)) {
      throw paymentHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'legacyPortalUserId must be an integer');
    }
    if (!Number.isInteger(body.amountMinor) || body.amountMinor <= 0) {
      throw paymentHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'amountMinor must be a positive integer');
    }
    if (!body.currency?.trim()) {
      throw paymentHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'currency is required');
    }
    if (!body.metadata?.salaryPayoutLineId) {
      throw paymentHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'metadata.salaryPayoutLineId is required');
    }
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
