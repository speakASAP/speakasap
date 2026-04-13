import { Injectable, Logger } from '@nestjs/common';

export type DisburseBody = {
  idempotencyKey: string;
  legacyPortalUserId: number;
  amountMinor: number;
  currency: string;
  metadata: { salaryPayoutLineId: string; period: string };
};

export type DisburseResponse = {
  payoutRef: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
};

@Injectable()
export class PaymentClientService {
  private readonly logger = new Logger(PaymentClientService.name);

  async disburse(body: DisburseBody, idempotencyKey: string): Promise<DisburseResponse> {
    const base = process.env.PAYMENT_SERVICE_URL?.replace(/\/$/, '');
    if (!base) {
      throw new Error('PAYMENT_SERVICE_URL_missing');
    }
    const token =
      process.env.PAYMENT_SERVICE_INTERNAL_TOKEN || process.env.INTERNAL_API_TOKEN || '';
    const url = `${base}/api/v1/internal/salary/disburse`;
    const timeoutMs = Number(process.env.HTTP_CLIENT_TIMEOUT_MS || '8000');
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const durationMs = Date.now() - started;
      if (!res.ok) {
        this.logger.error(`payment disburse failed status=${res.status} duration_ms=${durationMs}`);
        throw new Error(`payment_disburse_${res.status}`);
      }
      const json = (await res.json()) as DisburseResponse;
      this.logger.log(`payment disburse ok duration_ms=${durationMs} payoutRef=${json.payoutRef}`);
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  async pollDisburse(payoutRef: string): Promise<DisburseResponse> {
    const base = process.env.PAYMENT_SERVICE_URL?.replace(/\/$/, '');
    if (!base) {
      throw new Error('PAYMENT_SERVICE_URL_missing');
    }
    const token =
      process.env.PAYMENT_SERVICE_INTERNAL_TOKEN || process.env.INTERNAL_API_TOKEN || '';
    const url = `${base}/api/v1/internal/salary/disburse/${encodeURIComponent(payoutRef)}`;
    const timeoutMs = Number(process.env.HTTP_CLIENT_TIMEOUT_MS || '8000');
    const maxAttempts = 5;
    const delayMs = 200;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'X-Internal-Token': token },
          signal: controller.signal,
        });
        const durationMs = Date.now() - started;
        if (!res.ok) {
          this.logger.warn(
            `payment poll disburse attempt=${attempt} status=${res.status} duration_ms=${durationMs}`,
          );
        } else {
          const json = (await res.json()) as DisburseResponse;
          this.logger.log(
            `payment poll disburse attempt=${attempt} duration_ms=${durationMs} status=${json.status}`,
          );
          if (json.status === 'completed' || json.status === 'failed') {
            return json;
          }
        }
      } finally {
        clearTimeout(timer);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return { payoutRef, status: 'processing' };
  }
}
