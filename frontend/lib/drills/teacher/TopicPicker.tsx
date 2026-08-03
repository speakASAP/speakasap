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

  const toggle = (topic: DrillTopicDTO) => {
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
    <fieldset>
      <legend>Topics</legend>

      <ul>
        {topics.map((topic) => (
          <li key={topic.slug}>
            <label>
              <input
                type="checkbox"
                checked={selectedSlugs.has(topic.slug)}
                onChange={() => toggle(topic)}
              />
              {topic.title}
            </label>
            {/*
              A topic with no mapped grammar page renders as plain text. An anchor with an
              empty href would look like a link and go to the current page instead.
            */}
            {topic.publicUrl ? (
              <a href={topic.publicUrl} target="_blank" rel="noreferrer">
                {topic.slug}
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      {allowCreate ? (
        <label>
          Add a topic
          <input
            role="combobox"
            aria-expanded={false}
            aria-label="Add a topic"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitDraft();
              }
            }}
          />
        </label>
      ) : (
        <label>
          Filter topics
          <input
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
