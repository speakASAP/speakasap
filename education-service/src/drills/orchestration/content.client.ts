import { Injectable } from '@nestjs/common';
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
   * Replaces the items at `positions` (DrillSetItem.order values) with `items`, writing
   * the outgoing rows to DrillItemRevision first. Internal-only: the request body
   * carries `blanks`, and `blanks` carries answers.
   */
  async replaceSetItems(
    setUuid: string,
    positions: number[],
    items: ReplacementItem[],
    options: { recordRevisionReason: string },
    token: string,
  ): Promise<DrillSetDetailDTO> {
    return requestUpstream<DrillSetDetailDTO>({
      url: `${this.baseUrl()}/api/v1/internal/drill-sets/${encodeURIComponent(setUuid)}/replace-items`,
      method: 'POST',
      token,
      internalToken: this.internalToken(),
      body: { positions, items, recordRevisionReason: options.recordRevisionReason },
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  /**
   * Patches a set's review state. content-service refuses to grant APPROVED through
   * this route — that decision belongs to the approve route, which is where the "no
   * item is still FAIL" check lives.
   */
  async updateSet(
    setUuid: string,
    patch: { reviewState?: DrillSetReviewState },
    token: string,
  ): Promise<DrillSetDTO> {
    return requestUpstream<DrillSetDTO>({
      url: `${this.baseUrl()}/api/v1/internal/drill-sets/${encodeURIComponent(setUuid)}/update`,
      method: 'POST',
      token,
      internalToken: this.internalToken(),
      body: patch,
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  private baseUrl(): string {
    return requiredEnv('CONTENT_SERVICE_URL', UPSTREAM);
  }

  private internalToken(): string {
    return requiredEnv('INTERNAL_API_TOKEN', UPSTREAM);
  }
}
