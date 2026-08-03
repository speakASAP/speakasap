'use client';

import { useCallback, useEffect, useState } from 'react';
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
    <main>
      <h1>Drill library</h1>
      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p>Loading…</p> : null}
      <LibraryBrowser sets={sets} groups={groups} onQuery={(query) => void load(query)} />
    </main>
  );
}
