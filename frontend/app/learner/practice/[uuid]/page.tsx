'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import type { RunnerResponse } from '@/lib/drills/contracts';
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

  const onComplete = useCallback(() => setCompleted(true), []);

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
      </div>
    </main>
  );
}
