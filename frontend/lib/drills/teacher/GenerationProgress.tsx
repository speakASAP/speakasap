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
      <section aria-label="Generation progress">
        <p role="alert">{progress.message || 'Generation failed'}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section aria-label="Generation progress">
      <p>{progress.message}</p>
      <p data-testid="generation-count">
        {progress.generated} of {progress.total}
      </p>
      {/*
        A stalled job says so. Counting an estimate down to "0s" while nothing is
        happening tells the teacher the work is about to finish, which is the opposite of
        what is true, so the estimate is replaced rather than floored at zero.
      */}
      {progress.stalled ? (
        <p>This is taking longer than expected.</p>
      ) : progress.etaSeconds !== null && progress.etaSeconds > 0 ? (
        <p>{progress.etaSeconds} s</p>
      ) : null}
      {items && items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.template}</li>
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
