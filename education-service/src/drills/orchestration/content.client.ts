import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  DrillBlank,
  DrillItemSearchRequest,
  DrillItemSearchResponse,
  DrillSetDetailDTO,
  DrillSetDTO,
  DrillSetOrigin,
  DrillSetReviewState,
  DrillTemplate,
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

/** A replacement drill item, not yet persisted — content-service assigns the id. */
export interface ReplacementItem {
  template: DrillTemplate;
  blanks: DrillBlank[];
  hint: string | null;
  topicSlug: string;
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

  async getSet(setUuid: string, token: string): Promise<DrillSetDetailDTO> {
    return requestUpstream<DrillSetDetailDTO>({
      url: `${this.baseUrl()}/api/v1/internal/drill-sets/${encodeURIComponent(setUuid)}`,
      method: 'GET',
      token,
      internalToken: this.internalToken(),
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  /**
   * NOT AVAILABLE UPSTREAM — see the note on updateSet below.
   *
   * Replaces the items at `positions` (DrillSetItem.order values) with `items`,
   * writing the outgoing rows to DrillItemRevision first. The revision model already
   * exists in content-service's schema (Track A); only the HTTP route is missing.
   */
  async replaceSetItems(
    _setUuid: string,
    _positions: number[],
    _items: ReplacementItem[],
    _options: { recordRevisionReason: string },
    _token: string,
  ): Promise<void> {
    throw new NotImplementedException(
      'content-service exposes no drill-set item replacement route; see Track D handoff notes',
    );
  }

  /**
   * NOT AVAILABLE UPSTREAM. Track A2 shipped create/approve/rate only — there is no
   * route in content-service that mutates an existing set (verified against
   * src/drills/sets/sets.controller.ts on the Track A2 tree).
   *
   * Task D.4's regeneration loop needs both this and replaceSetItems. They throw
   * rather than faking success: a regeneration that silently kept the rejected items,
   * or left an APPROVED set approved after its contents changed, would put
   * unreviewed sentences in front of a student. All the orchestration logic around
   * them is implemented and tested; adding the two routes to content-service is the
   * only remaining work.
   */
  async updateSet(
    _setUuid: string,
    _patch: { reviewState?: DrillSetReviewState },
    _token: string,
  ): Promise<DrillSetDTO> {
    throw new NotImplementedException(
      'content-service exposes no drill-set update route; see Track D handoff notes',
    );
  }

  private baseUrl(): string {
    return requiredEnv('CONTENT_SERVICE_URL', UPSTREAM);
  }

  private internalToken(): string {
    return requiredEnv('INTERNAL_API_TOKEN', UPSTREAM);
  }
}
