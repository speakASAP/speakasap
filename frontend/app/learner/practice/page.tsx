'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { DrillAssignmentDTO, DrillSetDTO } from '@/lib/drills/contracts';
import { listAvailableSets, listMyAssignments } from '@/lib/drills/runner/api';
import { SelfDrillBrowser } from '@/lib/drills/runner/SelfDrillBrowser';
import { studentDashboardUrl } from '@/lib/drills/runner/portal-url';

/**
 * The student's practice home: assigned work first, self-drilling second.
 *
 * The ordering is the feature. Teacher-assigned drills are what gate self-drilling, so
 * showing them first makes the lock below self-explanatory.
 */
export default function PracticePage() {
  const [outstanding, setOutstanding] = useState<DrillAssignmentDTO[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [sets, setSets] = useState<DrillSetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // The library is fetched alongside the assignments rather than after the gate is
    // known: it is answer-free and lesson-scoped server-side, and waiting would put a
    // second round trip in front of every student who is allowed to drill.
    Promise.all([listMyAssignments(), listAvailableSets().catch(() => null)])
      .then(([assignments, library]) => {
        if (!active) {
          return;
        }
        setOutstanding(assignments.outstanding);
        setAllowed(assignments.selfDrillingAllowed);
        // A failed library load leaves the list empty rather than failing the page —
        // assigned work is the more important half and does not depend on it.
        setSets(library?.sets ?? []);
      })
      .catch(() => {
        if (active) {
          setError('Не удалось загрузить практику. Обновите страницу.');
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
  }, []);

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header>
          {/* The student arrives from the legacy cabinet through the SSO handoff and had
              no way back once a drill was finished. A plain anchor, not next/link: the
              portal is a different application on another host. */}
          <a
            href={studentDashboardUrl()}
            className="text-sm text-sky-700 underline hover:text-sky-900 dark:text-sky-400"
          >
            ← Мои курсы
          </a>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Портал ученика</p>
          <h1 className="mt-2 text-2xl font-semibold">Практика</h1>
        </header>

        {error ? (
          <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
            {error}
          </p>
        ) : null}

        {loading ? <p className="text-slate-600">Загрузка…</p> : null}

        {/* A failed load knows neither what is assigned nor whether self-drilling is
            allowed. Rendering either section from those defaults tells the student
            something false — "nothing assigned" beside a lock claiming an assignment is
            outstanding — so the error message stands alone until a refresh succeeds. */}
        {loading || error ? null : (
          <>
            <section>
              <h2 className="text-lg font-semibold">Назначено вам</h2>
              {outstanding.length === 0 ? (
                <p className="mt-2 text-slate-600">Сейчас ничего не назначено.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {outstanding.map((assignment) => (
                    <li
                      key={assignment.uuid}
                      className="flex items-center justify-between rounded border p-3"
                    >
                      <span>
                        <span className="font-medium">{assignment.title}</span>{' '}
                        <span className="text-sm text-slate-500">
                          {assignment.blanksCorrect} из {assignment.blanksTotal} пропусков
                        </span>
                      </span>
                      <Link
                        href={`/learner/practice/${assignment.uuid}`}
                        className="rounded bg-sky-600 px-3 py-1 text-white"
                      >
                        Продолжить
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <SelfDrillBrowser
              allowed={allowed}
              blockingTitle={outstanding[0]?.title ?? null}
              sets={sets}
              onStarted={(uuid) => {
                window.location.href = `/learner/practice/${uuid}`;
              }}
            />
          </>
        )}
      </div>
    </main>
  );
}
