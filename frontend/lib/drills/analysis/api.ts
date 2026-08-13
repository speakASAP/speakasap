import { request } from '@/lib/drills/teacher/api';
import type {
  AnalysisResponse,
  GapCluster,
  GapPatch,
  RemedialCreationResult,
} from './contracts';
import { MIN_REMEDIAL_SENTENCES } from './contracts';

/**
 * Analysis and remedial-drill calls for the error-analysis feature.
 *
 * Built on the same `request` helper as `lib/drills/teacher/api.ts` — same auth handling,
 * same base URL, same `DrillApiError` on failure — rather than a second copy of it.
 */

/**
 * The error analysis for one completed assignment.
 *
 * Rejects on failure rather than returning an empty analysis: an empty one renders as
 * "no mistakes", which is the opposite of what a failed request means.
 */
export function fetchAnalysis(assignmentUuid: string): Promise<AnalysisResponse> {
  return request(`/drill-assignments/${encodeURIComponent(assignmentUuid)}/analysis`);
}

export function retryAnalysis(assignmentUuid: string): Promise<{ queued: boolean }> {
  return request(`/drill-assignments/${encodeURIComponent(assignmentUuid)}/analysis/retry`, {
    method: 'POST',
  });
}

export function updateGap(gapUuid: string, patch: GapPatch): Promise<GapCluster> {
  return request(`/drill-assignments/teacher/gaps/${encodeURIComponent(gapUuid)}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function createRemedial(gapUuid: string): Promise<RemedialCreationResult> {
  return request(`/drill-assignments/teacher/gaps/${encodeURIComponent(gapUuid)}/remedial`, {
    method: 'POST',
  });
}

/**
 * How long the remedial drill for this gap will be, shown BEFORE the teacher clicks.
 *
 * Mirrors `composeRemedial` on the server: one sentence per mistake, floored at the
 * ten-sentence minimum. It deliberately does not account for already-mastered words — the
 * client does not know them, and the server's refusal is the authority. This is a
 * preview, not a promise.
 */
export function remedialSentenceCount(cluster: GapCluster): number {
  const required = cluster.failedAnswers.reduce((sum, a) => sum + a.mistakeCount, 0);
  if (required === 0) {
    return 0;
  }
  return Math.max(MIN_REMEDIAL_SENTENCES, required);
}
