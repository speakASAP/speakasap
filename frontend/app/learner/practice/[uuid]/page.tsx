'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import type { RunnerResponse } from '@/lib/drills/contracts';
import type { GapCluster } from '@/lib/drills/analysis/contracts';
import { fetchGap } from '@/lib/drills/analysis/api';
import { GapCard } from '@/lib/drills/analysis/GapCard';
import { GapAnalysisBlock } from '@/lib/drills/analysis/GapAnalysisBlock';
import { DrillRunner } from '@/lib/drills/runner/DrillRunner';
import { fetchRunner } from '@/lib/drills/runner/api';

/**
 * One assignment, running.
 *
 * The payload is the answer-free runner shape, and no answer is ever requested or held
 * here — every check goes to the server, which is the only place the expected text lives.
 */
export default function PracticeRunnerPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = params?.uuid;

  const [runner, setRunner] = useState<RunnerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [analysisRefresh, setAnalysisRefresh] = useState(0);
  const [theory, setTheory] = useState<GapCluster | null>(null);

  useEffect(() => {
    if (!uuid) {
      return;
    }
    let active = true;
    setLoading(true);
    fetchRunner(uuid)
      .then((response) => {
        if (active) {
          setRunner(response);
        }
      })
      .catch(() => {
        if (active) {
          setError('Could not load this drill. Please refresh.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [uuid]);

  useEffect(() => {
    const gapUuid = runner?.assignment?.sourceAnalysisUuid;
    if (!gapUuid) {
      return;
    }
    let active = true;
    fetchGap(gapUuid)
      .then((cluster) => {
        if (active) {
          setTheory(cluster);
        }
      })
      .catch((error) => {
        // The drill itself is still usable without the theory above it, so this does not
        // replace the page — but it must not vanish either.
        if (active) {
          setError(
            `Не удалось загрузить теорию к этой работе над ошибками: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      });
    return () => {
      active = false;
    };
  }, [runner]);

  // Completion both reveals the "done" banner and kicks the analysis block into polling:
  // the request that finished the drill is what enqueued the analysis server-side, so the
  // block must re-ask now rather than keep the `NOT_ANALYZED` it saw on mount.
  const onComplete = useCallback(() => {
    setCompleted(true);
    setAnalysisRefresh((n) => n + 1);
  }, []);

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link href="/learner/practice" className="text-sm text-sky-700 underline">
          ← Back to practice
        </Link>

        {error ? (
          <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
            {error}
          </p>
        ) : null}

        {loading ? <p className="text-slate-600">Loading…</p> : null}

        {theory ? (
          <div data-testid="remedial-theory">
            <GapCard cluster={theory} showRemedialAction={false} />
          </div>
        ) : null}

        {runner ? (
          <DrillRunner
            assignment={runner.assignment}
            items={runner.items}
            onComplete={onComplete}
          />
        ) : null}

        {completed ? (
          <p className="rounded border border-green-300 bg-green-50 p-4 text-green-900">
            Done — every blank is filled. Nice work.
          </p>
        ) : null}

        {/*
          `drillCompleted` is true both for a drill finished in this session and for one
          finished earlier and reopened — the server's status covers the reload case, which
          local `completed` state cannot.
        */}
        {uuid ? (
          <GapAnalysisBlock
            assignmentUuid={uuid}
            audience="student"
            refreshKey={analysisRefresh}
            drillCompleted={completed || runner?.assignment?.status === 'COMPLETED'}
          />
        ) : null}
      </div>
    </main>
  );
}
