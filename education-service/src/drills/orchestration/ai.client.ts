import { Injectable } from '@nestjs/common';
import {
  GenerateDrillRequest,
  GenerateDrillResponse,
  ValidateDrillRequest,
  ValidateDrillResponse,
} from '../contracts';
import { numericEnv, requestUpstream, requiredEnv } from './http';
import { mintServiceToken } from './service-token';

const UPSTREAM = 'ai-microservice';

/** Identifies this service in the minted token's `serviceId` claim. */
const SERVICE_ID = 'education-service';

/**
 * Calls Track C's generator and validator agents.
 *
 * The timeout budget is deliberately far larger than the content client's:
 * generation is a model call over a long prompt, and aborting it at 30s would
 * fail every real run while still billing for the tokens already produced.
 *
 * AUTHENTICATION — deliberately NOT the caller's token.
 *
 * Both methods take the teacher's bearer token because every other client in
 * this module does, but it is not what goes on the wire. ai-microservice's
 * `TeacherAssistantController` sits behind `ServiceAuthGuard`, which verifies a
 * service JWT signed with `AI_SERVICE_JWT_SECRET` — it has no per-user concept
 * at all. Forwarding the teacher's token produced `401 Malformed token` on every
 * generation until this was fixed (production, 2026-08-03).
 *
 * The parameter is kept rather than removed so `GenerationJob.token` still
 * threads through one shape for every upstream, and so a future ai-microservice
 * route that *does* care about the end user has it available.
 */
@Injectable()
export class AiClient {
  timeoutMs(): number {
    return numericEnv('DRILL_AI_CLIENT_TIMEOUT_MS', 180000);
  }

  async generate(req: GenerateDrillRequest, _token: string): Promise<GenerateDrillResponse> {
    return requestUpstream<GenerateDrillResponse>({
      url: `${this.baseUrl()}/api/teacher-assistant/generate-drill`,
      method: 'POST',
      token: this.serviceToken(),
      body: req,
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  async validate(req: ValidateDrillRequest, _token: string): Promise<ValidateDrillResponse> {
    return requestUpstream<ValidateDrillResponse>({
      url: `${this.baseUrl()}/api/teacher-assistant/validate-drill`,
      method: 'POST',
      token: this.serviceToken(),
      body: req,
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  /**
   * Minted per call. An HMAC costs nothing beside the model call that follows,
   * and a short-lived token that is never stored has nothing to invalidate when
   * the secret rotates.
   */
  private serviceToken(): string {
    return mintServiceToken(SERVICE_ID, requiredEnv('AI_SERVICE_JWT_SECRET', UPSTREAM));
  }

  private baseUrl(): string {
    return requiredEnv('AI_SERVICE_URL', UPSTREAM);
  }
}
