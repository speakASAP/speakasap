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
    <li key={set.uuid}>
      <label>
        <input
          type="checkbox"
          checked={selected.includes(set.uuid)}
          onChange={() => toggle(set.uuid)}
        />
        {set.title}
      </label>
      <span>{set.topicSlugs.join(', ')}</span>
      <span>{set.itemCount} exercises</span>
      <span>Used {set.timesAssigned} times</span>
      <span>★ {set.popularityScore}</span>
    </li>
  );

  return (
    <section>
      <label htmlFor="library-search">Search sentences</label>
      <input
        id="library-search"
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            search();
          }
        }}
      />

      {groupKeys.length > 0 ? (
        groupKeys.map((key) => (
          <fieldset key={key} aria-label={groupLabel(key)}>
            <legend>{groupLabel(key)}</legend>
            <ul>
              {groups[key]
                .map((uuid) => byUuid.get(uuid))
                .filter((set): set is DrillSetDTO => Boolean(set))
                .map(renderSet)}
            </ul>
          </fieldset>
        ))
      ) : (
        <ul>{sets.map(renderSet)}</ul>
      )}

      <button
        type="button"
        disabled={selected.length === 0}
        onClick={() => onAssign?.(selected)}
      >
        Assign selected
      </button>
    </section>
  );
}
