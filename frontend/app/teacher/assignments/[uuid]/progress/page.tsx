'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DrillApiError, getTeacherProgress, type TeacherProgress } from '@/lib/drills/teacher/api';

/**
 * What a student has done with one drill.
 *
 * A teacher asked to see "what is finished and what are the errors there". Counts cannot
 * answer that, and the runner payload is deliberately answer-free — so this is the one
 * teacher-only view that shows the expected answer next to what the student typed.
 */
export default function AssignmentProgressPage() {
  const params = useParams<{ uuid: string }>();
  const router = useRouter();
  const [progress, setProgress] = useState<TeacherProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.uuid) {
      return;
    }
    let cancelled = false;
    getTeacherProgress(params.uuid)
      .then((data) => {
        if (!cancelled) {
          setProgress(data);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof DrillApiError ? e.message : 'Could not load this drill');
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
  }, [params?.uuid]);

  const allBlanks = progress?.items.flatMap((item) => item.blanks) ?? [];
  const solved = allBlanks.filter((b) => b.solved).length;
  const revealed = allBlanks.filter((b) => b.revealed).length;
  const withMistakes = allBlanks.filter((b) => b.wrongAttempts.length > 0).length;

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <button
          type="button"
          className="text-sm text-sky-700 underline hover:text-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-sky-400"
          onClick={() => router.back()}
        >
          ← Back
        </button>

        <h1 className="text-2xl font-semibold">{progress ? progress.title : 'Drill progress'}</h1>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading progress">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        ) : null}

        {progress && progress.items.length === 0 ? (
          /*
           * Assignment items are copied from the set at APPROVAL, so a set still awaiting
           * review has none. Rendering the tiles here showed "0 / 0 Solved" over an empty
           * list, which reads as "the student did nothing" when in fact they have never
           * been able to start.
           *
           * ASSIGNED with no items is a different thing — the student has work with no
           * content, which is a defect — so it is not described with the reassuring
           * approval wording.
           */
          <p
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            {progress.status === 'PENDING_REVIEW'
              ? 'This set is still awaiting your approval, so the student has not started it yet. Approve it on the review screen and progress will appear here.'
              : 'This assignment has no sentences, so there is no progress to show. Please report it if it stays this way.'}
          </p>
        ) : null}

        {progress && progress.items.length > 0 ? (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              {[
                { label: 'Solved', value: `${solved} / ${allBlanks.length}` },
                { label: 'With mistakes', value: String(withMistakes) },
                { label: 'Revealed', value: String(revealed) },
                { label: 'Status', value: progress.status },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-lg font-semibold">{tile.value}</p>
                  <p className="text-xs text-zinc-500">{tile.label}</p>
                </div>
              ))}
            </section>

            <ol className="space-y-3">
              {progress.items.map((item, i) => (
                <li
                  key={item.uuid}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-xs text-zinc-500">Sentence {i + 1}</p>

                  <ul className="mt-2 space-y-2">
                    {item.blanks.map((blank) => (
                      <li key={blank.index} className="text-sm">
                        <span className="text-zinc-500">{blank.prompt} → </span>
                        <span className="font-semibold">{blank.answer}</span>

                        {blank.solved ? (
                          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-900 dark:bg-green-950 dark:text-green-200">
                            solved{blank.attemptCount > 1 ? ` after ${blank.attemptCount}` : ''}
                          </span>
                        ) : blank.revealed ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            revealed
                          </span>
                        ) : (
                          <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            not done
                          </span>
                        )}

                        {blank.wrongAttempts.length > 0 ? (
                          <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                            {/* What they actually typed — the shape of the mistake is what a teacher acts on. */}
                            tried: {blank.wrongAttempts.join(', ')}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {item.hint ? (
                    <p className="mt-2 text-xs text-zinc-500">{item.hint}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </main>
  );
}
