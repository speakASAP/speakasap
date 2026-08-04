'use client';

import { useEffect, useRef, useState } from 'react';
import type { GenerationPhase, GenerationProgress as GenerationProgressDTO } from '@/lib/drills/contracts';
import { getAssignment } from './api';

const POLL_INTERVAL_MS = 2000;

/** Phases after which nothing further will arrive, so polling stops. */
const TERMINAL: GenerationPhase[] = ['READY', 'FAILED'];

function isTerminal(phase: GenerationPhase): boolean {
  return TERMINAL.includes(phase);
}

export interface GeneratedItemPreview {
  id: number;
  template: string;
}

export interface GenerationProgressViewProps {
  progress: GenerationProgressDTO;
  items?: GeneratedItemPreview[];
  onRetry?: () => void;
}

/**
 * The progress panel, with no data-fetching of its own.
 *
 * Split from the polling component so the states that matter — stalled, failed, partially
 * generated — can be rendered directly in a test and read directly in Storybook, rather
 * than being reachable only by driving a timer.
 */
export function GenerationProgressView({
  progress,
  items,
  onRetry,
}: GenerationProgressViewProps) {
  if (progress.phase === 'FAILED') {
    return (
      <section
        aria-label="Generation progress"
        className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950"
      >
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {progress.message || 'Generation failed'}
        </p>
        {onRetry ? (
          <button
            type="button"
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            onClick={onRetry}
          >
            Retry
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-label="Generation progress"
      className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent"
        />
        <p className="text-sm font-medium">{progress.message}</p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={progress.generated}
        aria-valuemin={0}
        aria-valuemax={progress.total || 1}
        className="h-2 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className="h-full bg-sky-600 transition-[width]"
          style={{
            width: progress.total
              ? `${(progress.generated / progress.total) * 100}%`
              : '0%',
          }}
        />
      </div>

      <p data-testid="generation-count" className="text-sm text-zinc-600 dark:text-zinc-400">
        {progress.generated} of {progress.total}
      </p>
      {/*
        A stalled job says so. Counting an estimate down to "0s" while nothing is
        happening tells the teacher the work is about to finish, which is the opposite of
        what is true, so the estimate is replaced rather than floored at zero.
      */}
      {progress.stalled ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          This is taking longer than expected.
        </p>
      ) : progress.etaSeconds !== null && progress.etaSeconds > 0 ? (
        <p className="text-sm text-zinc-500">{progress.etaSeconds} s</p>
      ) : null}
      {items && items.length > 0 ? (
        <ul className="space-y-1 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
          {items.map((item) => (
            <li key={item.id} className="text-zinc-600 dark:text-zinc-400">
              {item.template}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export interface GenerationProgressProps {
  /** Poll this assignment. Ignored when `progress` is supplied. */
  assignmentUuid?: string;
  /** Drive the panel from the outside instead of polling. */
  progress?: GenerationProgressDTO;
  onReady: () => void;
  onRetry?: () => void;
}

/**
 * Watches a generation job and reports when it is ready.
 *
 * Polls on an interval rather than holding a socket open: generation takes tens of
 * seconds, the teacher is watching the screen, and a dropped poll costs one cycle
 * instead of a reconnect. Polling stops as soon as the phase is terminal — a job that has
 * finished will not change again, and a page left open must not keep hitting the API.
 *
 * A failed poll is deliberately not terminal. The generation is still running on the
 * server, and stopping on a transient network error would freeze the panel with no way
 * for the teacher to tell the difference.
 */
export function GenerationProgress({
  assignmentUuid,
  progress: controlled,
  onReady,
  onRetry,
}: GenerationProgressProps) {
  const [polled, setPolled] = useState<GenerationProgressDTO | null>(null);
  const progress = controlled ?? polled;

  // `onReady` fires once per job. Kept in a ref rather than in state because a parent
  // that re-renders with a new closure must not re-arm it.
  const readyFired = useRef(false);

  useEffect(() => {
    if (!progress || !isTerminal(progress.phase)) {
      return;
    }
    if (progress.phase === 'READY' && !readyFired.current) {
      readyFired.current = true;
      onReady();
    }
  }, [progress, onReady]);

  useEffect(() => {
    if (!assignmentUuid || controlled) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const assignment = await getAssignment(assignmentUuid);
        if (cancelled) {
          return;
        }
        const next = assignment.generationProgress;
        if (next) {
          setPolled(next);
          if (isTerminal(next.phase)) {
            return;
          }
        }
      } catch {
        // Transient; the next tick tries again.
      }
      if (!cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [assignmentUuid, controlled]);

  if (!progress) {
    return <p>Starting…</p>;
  }

  return <GenerationProgressView progress={progress} onRetry={onRetry} />;
}
