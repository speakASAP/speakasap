import { Injectable } from '@nestjs/common';
import {
  GenerateDrillRequest,
  GenerateDrillResponse,
  ValidateDrillRequest,
  ValidateDrillResponse,
} from '../contracts';
import { numericEnv, requestUpstream, requiredEnv } from './http';

const UPSTREAM = 'ai-microservice';

/**
 * Calls Track C's generator and validator agents.
 *
 * The timeout budget is deliberately far larger than the content client's:
 * generation is a model call over a long prompt, and aborting it at 30s would
 * fail every real run while still billing for the tokens already produced.
 */
@Injectable()
export class AiClient {
  timeoutMs(): number {
    return numericEnv('DRILL_AI_CLIENT_TIMEOUT_MS', 180000);
  }

  async generate(req: GenerateDrillRequest, token: string): Promise<GenerateDrillResponse> {
    return requestUpstream<GenerateDrillResponse>({
      url: `${this.baseUrl()}/api/teacher-assistant/generate-drill`,
      method: 'POST',
      token,
      body: req,
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  async validate(req: ValidateDrillRequest, token: string): Promise<ValidateDrillResponse> {
    return requestUpstream<ValidateDrillResponse>({
      url: `${this.baseUrl()}/api/teacher-assistant/validate-drill`,
      method: 'POST',
      token,
      body: req,
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  private baseUrl(): string {
    return requiredEnv('AI_SERVICE_URL', UPSTREAM);
  }
}
