'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DrillSetDTO, DrillSetListQuery } from '@/lib/drills/contracts';
import { DrillApiError, listSets } from '@/lib/drills/teacher/api';
import { LibraryBrowser } from '@/lib/drills/teacher/LibraryBrowser';

const DEFAULT_QUERY: DrillSetListQuery = { groupBy: 'lesson', sort: 'popularity' };

/**
 * The drill set library.
 *
 * Opens grouped by lesson, which is how a teacher looks for "something for lesson 5".
 * A search replaces that with a flat result list, because the set holding a searched-for
 * sentence is usually filed under a different lesson than the one being viewed.
 */
export default function LibraryPage() {
  const router = useRouter();
  const [sets, setSets] = useState<DrillSetDTO[]>([]);
  const [groups, setGroups] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query: DrillSetListQuery) => {
    setLoading(true);
    setError(null);
    try {
      const response = await listSets(query);
      setSets(response.sets);
      setGroups(response.groups ?? {});
    } catch (e) {
      setError(e instanceof DrillApiError ? e.message : 'Could not load the library');
      setSets([]);
      setGroups({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(DEFAULT_QUERY);
  }, [load]);

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        {/*
          A teacher who opens the library and finds nothing suitable had no way out but
          the browser's own Back — router.back() first so an existing wizard, with its
          half-filled steps, is returned to rather than restarted.
        */}
        <button
          type="button"
          className="text-sm text-sky-700 underline hover:text-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-sky-400"
          onClick={() => router.back()}
        >
          ← Back
        </button>

        <h1 className="text-2xl font-semibold">Drill library</h1>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading the library">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        ) : (
          <LibraryBrowser sets={sets} groups={groups} onQuery={(query) => void load(query)} />
        )}
      </div>
    </main>
  );
}
