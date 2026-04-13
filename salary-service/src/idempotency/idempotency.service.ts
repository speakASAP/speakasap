import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export function requestBodyHash(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async pruneExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS);
    await this.prisma.idempotencyRecord.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }

  async lookupReplay(
    idempotencyKey: string,
    route: string,
    hash: string,
  ): Promise<
    | { match: true; statusCode: number; body: unknown }
    | { match: false; conflict: true }
    | null
  > {
    await this.pruneExpired();
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: { idempotencyKey },
    });
    if (!row) {
      return null;
    }
    if (row.route !== route || row.requestHash !== hash) {
      return { match: false, conflict: true };
    }
    return { match: true, statusCode: row.statusCode, body: row.responseBody as unknown };
  }

  async store(
    idempotencyKey: string,
    route: string,
    hash: string,
    statusCode: number,
    responseBody: unknown,
  ): Promise<void> {
    await this.prisma.idempotencyRecord.upsert({
      where: { idempotencyKey },
      create: {
        idempotencyKey,
        route,
        requestHash: hash,
        statusCode,
        responseBody: responseBody as object,
      },
      update: {
        route,
        requestHash: hash,
        statusCode,
        responseBody: responseBody as object,
      },
    });
  }
}
