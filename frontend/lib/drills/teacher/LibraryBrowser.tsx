'use client';

import { useState } from 'react';
import type { DrillSetDTO, DrillSetListQuery } from '@/lib/drills/contracts';

export interface LibraryBrowserProps {
  sets: DrillSetDTO[];
  /** `groupBy=lesson` output: `${courseKey}#${lessonOrder}` or 'unassigned' → set uuids. */
  groups: Record<string, string[]>;
  onQuery?: (query: DrillSetListQuery) => void;
  onAssign?: (setUuids: string[]) => void;
}

/**
 * Turns a group key into something a teacher reads.
 *
 * The key is `${courseKey}#${lessonOrder}`, where courseKey is itself colon-delimited
 * (`seven:german:ru`). Only the lesson number is worth showing — the course is the one
 * the teacher is already looking at.
 */
export function groupLabel(key: string): string {
  if (key === 'unassigned') {
    return 'Unassigned';
  }
  const lessonOrder = key.split('#')[1];
  return lessonOrder ? `Lesson ${lessonOrder}` : key;
}

/**
 * Browse and reuse existing drill sets.
 *
 * No row here shows a score. `DrillSetDTO` has no accuracy field, and none is derived
 * client-side: what a teacher sees is how often a set was used and how it was rated, which
 * is the signal for "is this worth reusing" without exposing per-student performance.
 *
 * Searching clears the lesson grouping rather than filtering inside it. A teacher who
 * types "whale" is looking for a sentence, and the set holding it is very often filed
 * under a different lesson than the one currently open.
 */
export function LibraryBrowser({ sets, groups, onQuery, onAssign }: LibraryBrowserProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [term, setTerm] = useState('');

  const byUuid = new Map(sets.map((set) => [set.uuid, set]));
  const groupKeys = Object.keys(groups);

  const toggle = (uuid: string) => {
    setSelected((prev) =>
      prev.includes(uuid) ? prev.filter((x) => x !== uuid) : [...prev, uuid],
    );
  };

  const search = () => {
    onQuery?.({ q: term, courseKey: undefined, lessonOrder: undefined, groupBy: undefined });
  };

  const renderSet = (set: DrillSetDTO) => (
    <li key={set.uuid} className="rounded-md px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800">
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-sky-600"
          checked={selected.includes(set.uuid)}
          onChange={() => toggle(set.uuid)}
        />
        <span className="font-medium">{set.title}</span>
      </label>
      <span className="ml-7 mr-2 text-xs text-zinc-500">{set.topicSlugs.join(', ')}</span>
      <span className="mr-2 text-xs text-zinc-500">{set.itemCount} exercises</span>
      <span className="text-xs text-zinc-500">Used {set.timesAssigned} times</span>
      <span>★ {set.popularityScore}</span>
    </li>
  );

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label
          htmlFor="library-search"
          className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          Search sentences
        </label>
      <input
        id="library-search"
        type="search"
        className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            search();
          }
        }}
      />
      </div>

      {sets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No approved sets match. Try a different search, or generate a new set.
        </p>
      ) : null}

      {groupKeys.length > 0 ? (
        groupKeys.map((key) => (
          <fieldset
            key={key}
            aria-label={groupLabel(key)}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <legend className="px-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {groupLabel(key)}
            </legend>
            <ul className="mt-2 space-y-1">
              {groups[key]
                .map((uuid) => byUuid.get(uuid))
                .filter((set): set is DrillSetDTO => Boolean(set))
                .map(renderSet)}
            </ul>
          </fieldset>
        ))
      ) : (
        <ul className="space-y-1 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {sets.map(renderSet)}
        </ul>
      )}

      <button
        type="button"
        className="rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={selected.length === 0}
        onClick={() => onAssign?.(selected)}
      >
        Assign selected
      </button>
    </section>
  );
}
