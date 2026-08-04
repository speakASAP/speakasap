'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { InternalTeacherAssignmentsResponse } from '@/lib/drills/contracts';
import { DrillApiError, getTeacherSummary } from '@/lib/drills/teacher/api';

/**
 * The teacher's drilling home.
 *
 * Built because approving a set redirected here and the route did not exist — a bare
 * Next 404 with no way back, immediately after an action that had actually succeeded.
 * It is the natural landing place after approving, so it shows what that approval did:
 * the counts, and anything still waiting on review.
 */
export default function TeacherAssignmentsPage() {
  const [summary, setSummary] = useState<InternalTeacherAssignmentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTeacherSummary()
      .then((response) => {
        if (!cancelled) {
          setSummary(response);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof DrillApiError ? e.message : 'Could not load your drilling summary');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tiles: { label: string; value: number }[] = summary
    ? [
        { label: 'Awaiting review', value: summary.awaitingReview },
        { label: 'Assigned', value: summary.assigned },
        { label: 'Completed this week', value: summary.completedThisWeek },
      ]
    : [];

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Drilling</h1>
          <Link
            href="/teacher/assignments/library"
            className="text-sm text-sky-700 underline hover:text-sky-900 dark:text-sky-400"
          >
            Browse the library
          </Link>
        </header>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3" aria-busy="true" aria-label="Loading your summary">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        ) : null}

        {summary ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              {tiles.map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-2xl font-semibold">{tile.value}</p>
                  <p className="text-xs text-zinc-500">{tile.label}</p>
                </div>
              ))}
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Waiting for your review
              </h2>
              {summary.reviewQueue.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  Nothing waiting. Drills you create from a lesson page appear here until
                  you approve them.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {summary.reviewQueue.map((entry) => (
                    <li
                      key={entry.setUuid}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span className="truncate text-sm font-medium">{entry.title}</span>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {entry.studentCount} student{entry.studentCount === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
