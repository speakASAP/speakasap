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
 * An UPPER BOUND, not a mirror of the server's rule. It applies the same sum-and-floor
 * arithmetic as `composeRemedial`, but cannot apply the server's mastery filter: a word
 * the student has since mastered is excluded there and counted here, so this can
 * overstate. Mastery advances independently of when the gap was analyzed, so the gap is
 * widest for older gaps.
 *
 * The server is the authority — it may also refuse outright with GAP_ALREADY_MASTERED.
 */
export function remedialSentenceCount(cluster: GapCluster): number {
  const required = cluster.failedAnswers.reduce((sum, a) => sum + a.mistakeCount, 0);
  if (required === 0) {
    return 0;
  }
  return Math.max(MIN_REMEDIAL_SENTENCES, required);
}
