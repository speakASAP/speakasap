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

const POLL_INTERVAL_MS = 4000;

interface GapAnalysisBlockProps {
  assignmentUuid: string;
  audience: 'student' | 'teacher';
  onRemedialCreated?: (result: RemedialCreationResult) => void;
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
}: GapAnalysisBlockProps) {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyGap, setBusyGap] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchAnalysis(assignmentUuid);
      setAnalysis(response);
      setLoadError(null);
      return response;
    } catch (error) {
      // Never fall back to an empty analysis — see the component doc comment.
      setLoadError(
        error instanceof Error ? error.message : 'Не удалось загрузить разбор ошибок',
      );
      return null;
    }
  }, [assignmentUuid]);

  useEffect(() => {
    let active = true;

    const tick = async () => {
      const response = await load();
      if (!active) {
        return;
      }
      if (response && IN_FLIGHT_STATUSES.includes(response.status)) {
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
  }, [load]);

  const onRetry = useCallback(async () => {
    setActionError(null);
    try {
      await retryAnalysis(assignmentUuid);
      await load();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Не удалось перезапустить разбор',
      );
    }
  }, [assignmentUuid, load]);

  const onCreateRemedial = useCallback(
    async (gapUuid: string) => {
      setActionError(null);
      setBusyGap(gapUuid);
      try {
        const result = await createRemedial(gapUuid);
        onRemedialCreated?.(result);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : 'Не удалось создать работу над ошибками',
        );
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

  if (!analysis || analysis.status === 'NOT_ANALYZED') {
    return null;
  }

  if (IN_FLIGHT_STATUSES.includes(analysis.status)) {
    return <p className="text-zinc-600 dark:text-zinc-400">Разбираем твои ошибки…</p>;
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
        />
      ))}
    </div>
  );
}
