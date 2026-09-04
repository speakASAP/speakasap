'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createRemedial,
  fetchAnalysis,
  retryAnalysis,
} from '@/lib/drills/analysis/api';
import {
  IN_FLIGHT_STATUSES,
  type AnalysisResponse,
  type RemedialCreationResult,
} from '@/lib/drills/analysis/contracts';
import { GapCard } from './GapCard';
import { isRedirectingToLogin } from '@/lib/auth-redirect';

const POLL_INTERVAL_MS = 4000;

interface GapAnalysisBlockProps {
  assignmentUuid: string;
  audience: 'student' | 'teacher';
  onRemedialCreated?: (result: RemedialCreationResult) => void;
  /**
   * Bumped by the parent the moment the drill completes.
   *
   * Analysis is enqueued server-side by the request that finished the drill, so a block
   * mounted while the student was still answering has already seen `NOT_ANALYZED` and
   * stopped polling. Without this the student finished the last blank and the page simply
   * never mentioned the analysis again until a manual reload.
   */
  refreshKey?: number;
  /**
   * Whether the drill is known to be finished.
   *
   * `NOT_ANALYZED` is ambiguous on its own: it means both "still being answered" and
   * "finished, and the job has not written its row yet". Rendering the first as a pending
   * message would put "разбираем ошибки" under every unfinished drill; rendering the
   * second as nothing leaves the student staring at a blank page. The parent knows which
   * it is, so it tells us.
   */
  drillCompleted?: boolean;
}

/**
 * The grammar theory for one completed drill.
 *
 * Every state is rendered distinctly and deliberately:
 *
 * - `NOT_ANALYZED` renders nothing — the drill is not finished, and an empty state here
 *   would appear on every drill a student has open.
 * - `PENDING`/`RUNNING` say so and keep polling.
 * - `NO_ERRORS` says there were no mistakes.
 * - `FAILED`, and a rejected request, render a VISIBLE error. Never an empty block: an
 *   empty block reads as "no mistakes", which is the opposite of what happened.
 */
export function GapAnalysisBlock({
  assignmentUuid,
  audience,
  onRemedialCreated,
  refreshKey = 0,
  drillCompleted = false,
}: GapAnalysisBlockProps) {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyGap, setBusyGap] = useState<string | null>(null);
  const [gapResults, setGapResults] = useState<
    Record<string, { reused: boolean; count: number; assignmentUuids: string[] }>
  >({});
  const [gapErrors, setGapErrors] = useState<Record<string, string | null>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchAnalysis(assignmentUuid);
      setAnalysis(response);
      setLoadError(null);
      return response;
    } catch (error) {
      // A 401 has already sent the browser to login. Showing "Разбор ошибок не удался:
      // Invalid token" on a page that is navigating away told the user their analysis had
      // failed, when in fact only their session had expired.
      if (isRedirectingToLogin(error)) {
        return null;
      }
      // Never fall back to an empty analysis — see the component doc comment.
      setLoadError(
        error instanceof Error ? error.message : 'Не удалось загрузить разбор ошибок',
      );
      return null;
    }
  }, [assignmentUuid]);

  // A per-gap confirmation describes one completed click against the analysis as it stood.
  // When the parent forces a reload the page around it has changed, so the message is
  // stale — and leaving it up would stack a second live region under whatever banner the
  // reload brings. Polling ticks deliberately do NOT clear it: the teacher must keep
  // seeing the confirmation for the click they just made.
  useEffect(() => {
    setGapResults({});
    setGapErrors({});
  }, [refreshKey, assignmentUuid]);

  useEffect(() => {
    let active = true;

    const tick = async () => {
      const response = await load();
      if (!active) {
        return;
      }
      // `NOT_ANALYZED` is a polling state too once the drill is finished: the completing
      // request enqueues the job and returns, so the run row appears a moment later.
      // Treating it as terminal is what left the student's page permanently blank.
      const waiting =
        response !== null &&
        (IN_FLIGHT_STATUSES.includes(response.status) ||
          (drillCompleted && response.status === 'NOT_ANALYZED'));

      if (waiting) {
        timer.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    void tick();

    return () => {
      active = false;
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [load, refreshKey, drillCompleted]);

  const onRetry = useCallback(async () => {
    setActionError(null);
    try {
      await retryAnalysis(assignmentUuid);
      await load();
    } catch (error) {
      if (isRedirectingToLogin(error)) {
        return;
      }
      setActionError(
        error instanceof Error ? error.message : 'Не удалось перезапустить разбор',
      );
    }
  }, [assignmentUuid, load]);

  const onCreateRemedial = useCallback(
    async (gapUuid: string) => {
      setActionError(null);
      setGapErrors((prev) => ({ ...prev, [gapUuid]: null }));
      setBusyGap(gapUuid);
      try {
        const result = await createRemedial(gapUuid);
        // Recorded per gap so the card that was clicked can confirm itself. The page-level
        // callback stays — it drives the banner at the top — but it is no longer the only
        // sign that anything happened.
        //
        // The uuids travel with the confirmation because the drill lands in PENDING_REVIEW:
        // the card turns them into review links, which is the only way a teacher reaches
        // the approval screen from here.
        setGapResults((prev) => ({
          ...prev,
          [gapUuid]: {
            reused: result.reused,
            count: result.assignmentUuids.length,
            assignmentUuids: result.assignmentUuids,
          },
        }));
        onRemedialCreated?.(result);
      } catch (error) {
        if (isRedirectingToLogin(error)) {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Не удалось создать работу над ошибками';
        setActionError(message);
        setGapErrors((prev) => ({ ...prev, [gapUuid]: message }));
      } finally {
        setBusyGap(null);
      }
    },
    [onRemedialCreated],
  );

  if (loadError) {
    return (
      <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
        Разбор ошибок не удался: {loadError}
      </p>
    );
  }

  // Before the run row exists there is nothing to say — UNLESS the drill was just
  // finished, in which case the analysis is already queued and the student is told so
  // immediately instead of watching an empty page.
  const pending =
    IN_FLIGHT_STATUSES.includes(analysis?.status ?? 'NOT_ANALYZED') ||
    (drillCompleted && (!analysis || analysis.status === 'NOT_ANALYZED'));

  if (pending) {
    return (
      <section
        role="status"
        aria-live="polite"
        className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h3 className="text-lg font-semibold">Разбор ошибок</h3>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Идёт анализ ошибок… Разбор появится здесь через несколько секунд.
        </p>
      </section>
    );
  }

  if (!analysis || analysis.status === 'NOT_ANALYZED') {
    return null;
  }

  if (analysis.status === 'NO_ERRORS') {
    return (
      <p className="rounded border border-green-300 bg-green-50 p-4 text-green-900">
        Всё верно, ошибок нет.
      </p>
    );
  }

  if (analysis.status === 'FAILED') {
    return (
      <div className="space-y-2">
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
          Разбор ошибок не удался{analysis.errorMessage ? `: ${analysis.errorMessage}` : ''}
        </p>
        {audience === 'teacher' ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-zinc-400 px-3 py-2 text-sm"
          >
            Повторить разбор
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError ? (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {actionError}
        </p>
      ) : null}

      {analysis.clusters.map((cluster) => (
        <GapCard
          key={cluster.uuid}
          cluster={cluster}
          showRemedialAction={audience === 'teacher'}
          onCreateRemedial={onCreateRemedial}
          busy={busyGap === cluster.uuid}
          result={gapResults[cluster.uuid] ?? null}
          error={gapErrors[cluster.uuid] ?? null}
        />
      ))}
    </div>
  );
}
