import { Injectable } from '@nestjs/common';
import { numericEnv, requestUpstream, requiredEnv } from '../orchestration/http';
import { mintServiceToken } from '../orchestration/service-token';
import { AnalyzeErrorsRequest, AnalyzeErrorsResponse } from './contracts';

const UPSTREAM = 'ai-microservice';
const SERVICE_ID = 'education-service';

/**
 * Calls ai-microservice's error analyzer.
 *
 * AUTHENTICATION — a minted service token, never a caller's bearer token, for the same
 * reason as `AiClient`: `TeacherAssistantController` sits behind `ServiceAuthGuard`, which
 * verifies a service JWT signed with `AI_SERVICE_JWT_SECRET` and has no per-user concept.
 * Forwarding a user token returns `401 Malformed token`.
 *
 * **Not fail-soft.** A failure here must reach `AnalysisService`, which records it as a
 * `FAILED` run the student and teacher can see and retry. Returning empty clusters would
 * render as "no mistakes to explain" on a drill full of mistakes.
 */
@Injectable()
export class AnalysisClient {
  timeoutMs(): number {
    return numericEnv('DRILL_ANALYSIS_CLIENT_TIMEOUT_MS', 120000);
  }

  async analyze(req: AnalyzeErrorsRequest): Promise<AnalyzeErrorsResponse> {
    return requestUpstream<AnalyzeErrorsResponse>({
      url: `${this.baseUrl()}/api/teacher-assistant/analyze-drill-errors`,
      method: 'POST',
      token: this.serviceToken(),
      body: req,
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  private serviceToken(): string {
    return mintServiceToken(SERVICE_ID, requiredEnv('AI_SERVICE_JWT_SECRET', UPSTREAM));
  }

  private baseUrl(): string {
    return requiredEnv('AI_SERVICE_URL', UPSTREAM);
  }
}
