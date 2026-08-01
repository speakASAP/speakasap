import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  DrillItemSearchRequest,
  DrillItemSearchResponse,
  DrillSetDetailDTO,
  DrillSetOrigin,
  DrillSetReviewState,
  DrillTopicDTO,
  VocabularyBaseline,
} from '../contracts';
import { numericEnv, requestUpstream, requiredEnv } from './http';

const UPSTREAM = 'content-service';

/** Mirrors content-service's `CreateSetInput` (src/drills/sets/sets.service.ts). */
export interface CreateSetInput {
  uuid: string;
  title: string;
  languageId: number;
  materialLanguage: string;
  level?: string | null;
  topicSlugs?: string[];
  courseKey?: string | null;
  lessonOrder?: number | null;
  origin: DrillSetOrigin;
  reviewState?: DrillSetReviewState;
  createdByTeacherId?: number | null;
  instructions?: string | null;
  visibility?: 'SHARED' | 'PRIVATE';
  knownWordRatio?: number | null;
  itemIds: number[];
}

/**
 * Calls into content-service (Tracks A and A2) for the bank, the vocabulary
 * baseline and drill sets.
 *
 * Routes under `internal/` carry answers (`DrillBlank.answer`/`.alternatives`)
 * and are gated by the gateway on the `x-internal-token` header — a bearer
 * token alone is rejected with 403. See api-gateway/src/proxy/gateway-auth.guard.ts.
 */
@Injectable()
export class ContentClient {
  timeoutMs(): number {
    return numericEnv('DRILL_CLIENT_TIMEOUT_MS', 30000);
  }

  async searchItems(
    req: DrillItemSearchRequest,
    token: string,
  ): Promise<DrillItemSearchResponse> {
    return requestUpstream<DrillItemSearchResponse>({
      url: `${this.baseUrl()}/api/v1/internal/drill-items/search`,
      method: 'POST',
      token,
      internalToken: this.internalToken(),
      body: req,
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  async getBaseline(
    courseKey: string,
    languageCode: string,
    maxLessonOrder: number,
    token: string,
  ): Promise<VocabularyBaseline> {
    const query = new URLSearchParams({
      courseKey,
      languageCode,
      maxLessonOrder: String(maxLessonOrder),
    });
    return requestUpstream<VocabularyBaseline>({
      url: `${this.baseUrl()}/api/v1/internal/course-vocabulary?${query}`,
      method: 'GET',
      token,
      internalToken: this.internalToken(),
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  async getTopics(
    languageCode: string,
    materialLanguage: string,
    token: string,
  ): Promise<DrillTopicDTO[]> {
    const query = new URLSearchParams({ languageCode, materialLanguage });
    return requestUpstream<DrillTopicDTO[]>({
      url: `${this.baseUrl()}/api/v1/drill-topics?${query}`,
      method: 'GET',
      token,
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  async createSet(input: CreateSetInput, token: string): Promise<DrillSetDetailDTO> {
    return requestUpstream<DrillSetDetailDTO>({
      url: `${this.baseUrl()}/api/v1/internal/drill-sets`,
      method: 'POST',
      token,
      internalToken: this.internalToken(),
      body: input,
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  /**
   * NOT AVAILABLE UPSTREAM. Track A2 shipped create/approve/rate only — there is
   * no route in content-service that replaces the items of an existing set
   * (verified against src/drills/sets/sets.controller.ts on the Track A2 tree).
   *
   * Task D.4's regeneration loop needs it. This throws rather than faking a
   * success, because a regeneration that silently keeps the failed items would
   * put unvalidated sentences in front of a student. Resolve by adding the route
   * to content-service before wiring D.4.
   */
  async replaceSetItems(
    _setUuid: string,
    _positions: number[],
    _itemIds: number[],
    _token: string,
  ): Promise<DrillSetDetailDTO> {
    throw new NotImplementedException(
      'content-service exposes no drill-set item replacement route; see Track D handoff notes',
    );
  }

  private baseUrl(): string {
    return requiredEnv('CONTENT_SERVICE_URL', UPSTREAM);
  }

  private internalToken(): string {
    return requiredEnv('INTERNAL_API_TOKEN', UPSTREAM);
  }
}
