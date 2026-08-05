'use client';

import { useState } from 'react';
import type { DrillTopicDTO } from '@/lib/drills/contracts';

/**
 * A topic the teacher has chosen. Either one from the taxonomy, or one they typed that
 * the taxonomy has never seen — the spec requires a wholly new topic to work end to end,
 * so `isNew` travels with the selection rather than being inferred downstream.
 */
export type SelectedTopic = Pick<DrillTopicDTO, 'slug' | 'title'> & {
  publicUrl?: string | null;
  isNew?: boolean;
};

export interface TopicPickerProps {
  topics: DrillTopicDTO[];
  selected: SelectedTopic[];
  onChange: (next: SelectedTopic[]) => void;
  /** Allows a topic the taxonomy does not have yet. */
  allowCreate?: boolean;
}

/**
 * Derives a slug from free text.
 *
 * The teacher types a human topic name; the server keys on a slug. Doing this in the
 * browser keeps the typed title intact for display while still sending something the
 * bank can match against existing topics.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function TopicPicker({ topics, selected, onChange, allowCreate }: TopicPickerProps) {
  const [draft, setDraft] = useState('');
  const selectedSlugs = new Set(selected.map((t) => t.slug));

  /**
   * The taxonomy plus anything the teacher typed themselves.
   *
   * The list used to render `topics` alone, so a newly typed topic was accepted and sent
   * but never appeared: the box cleared and the panel still read "No topics yet", which
   * looked exactly like the input had been discarded. Own topics come first — the teacher
   * just added them, and hunting for one at the bottom of a long taxonomy is its own kind
   * of "did that work?".
   */
  const visibleTopics = [
    ...selected.filter((s) => !topics.some((t) => t.slug === s.slug)),
    ...topics,
  ];

  /**
   * Takes the narrow shape, not the full DTO: the list now also contains topics the
   * teacher typed, which have a slug and a title and none of the taxonomy's id,
   * languageCode, materialLanguage or level. Only slug and title are ever used here.
   */
  const toggle = (topic: SelectedTopic) => {
    if (selectedSlugs.has(topic.slug)) {
      onChange(selected.filter((t) => t.slug !== topic.slug));
      return;
    }
    onChange([
      ...selected,
      { slug: topic.slug, title: topic.title, publicUrl: topic.publicUrl, isNew: topic.isNew },
    ]);
  };

  const commitDraft = () => {
    const title = draft.trim();
    setDraft('');
    if (!allowCreate || !title) {
      return;
    }
    const slug = slugify(title);
    // A slug that collapses to nothing (punctuation only) is not a topic, and a repeat of
    // one already chosen would send the same topic twice.
    if (!slug || selectedSlugs.has(slug)) {
      return;
    }
    onChange([...selected, { slug, title, publicUrl: null, isNew: true }]);
  };

  return (
    <fieldset className="border-0 p-0">
      <legend className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Topics</legend>

      {visibleTopics.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          No topics yet — type one below and press Enter.
        </p>
      ) : null}

      <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
        {visibleTopics.map((topic) => (
          <li key={topic.slug} className="flex items-center justify-between gap-2">
            <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-sky-600"
                checked={selectedSlugs.has(topic.slug)}
                onChange={() => toggle(topic)}
              />
              <span className="truncate">{topic.title}</span>
            </label>
            {/*
              A topic with no mapped grammar page renders as plain text. An anchor with an
              empty href would look like a link and go to the current page instead.
            */}
            {topic.publicUrl ? (
              <a
                href={topic.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs text-sky-700 underline hover:text-sky-900 dark:text-sky-400"
              >
                {topic.slug}
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      {allowCreate ? (
        <label className="mt-3 block text-sm text-zinc-700 dark:text-zinc-300">
          Add a topic
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
            role="combobox"
            aria-expanded={false}
            aria-label="Add a topic"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            // Also on blur, not only on Enter. A teacher who typed a topic and pressed
            // Next had it silently discarded, and the request went out with no topics —
            // which is what produced an empty generated set. A field that looks filled
            // must never be treated as empty. commitDraft ignores a blank box.
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitDraft();
              }
            }}
          />
        </label>
      ) : (
        <label className="mt-3 block text-sm text-zinc-700 dark:text-zinc-300">
          Filter topics
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
            role="combobox"
            aria-expanded={false}
            aria-label="Filter topics"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
          />
        </label>
      )}
    </fieldset>
  );
}
