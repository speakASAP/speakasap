'use client';

import { useState } from 'react';
import type { DrillTopicDTO } from '@/lib/drills/contracts';
import { TopicPicker, type SelectedTopic } from './TopicPicker';

export const DEFAULT_ITEM_COUNT = 10;
export const MIN_ITEM_COUNT = 1;
export const MAX_ITEM_COUNT = 200;

export interface WizardWhatValue {
  topics: SelectedTopic[];
  instructions: string;
  count: number;
}

export interface WizardWhatProps {
  onNext: (value: WizardWhatValue) => void;
  topics?: DrillTopicDTO[];
}

/**
 * Step "What": what the drill is about.
 *
 * A request needs *something* to generate from — either a topic or free-text
 * instructions. Requiring both would block the two cases the spec calls for: a plain
 * topic drill with nothing to add, and a purely free-text request ("the mistakes she
 * made in yesterday's essay") that no taxonomy entry covers.
 */
export function WizardWhat({ onNext, topics = [] }: WizardWhatProps) {
  const [selected, setSelected] = useState<SelectedTopic[]>([]);
  const [instructions, setInstructions] = useState('');
  // Held as a string so a cleared field is empty rather than snapping back to 0, which
  // would read as a valid count of zero.
  const [count, setCount] = useState(String(DEFAULT_ITEM_COUNT));

  const parsedCount = Number(count);
  const countValid =
    Number.isInteger(parsedCount) &&
    parsedCount >= MIN_ITEM_COUNT &&
    parsedCount <= MAX_ITEM_COUNT;
  const hasSubject = selected.length > 0 || instructions.trim().length > 0;
  const canContinue = hasSubject && countValid;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canContinue) {
          return;
        }
        onNext({ topics: selected, instructions: instructions.trim(), count: parsedCount });
      }}
    >
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <TopicPicker topics={topics} selected={selected} onChange={setSelected} allowCreate />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label
          htmlFor="drill-instructions"
          className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          Instructions
        </label>
        <textarea
          id="drill-instructions"
          rows={3}
          className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Anything the generator should know — a focus, a context, mistakes to drill."
        />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label
          htmlFor="drill-count"
          className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          Number of exercises
        </label>
        <input
          id="drill-count"
          type="number"
          min={MIN_ITEM_COUNT}
          max={MAX_ITEM_COUNT}
          className="mt-2 w-28 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
        <p className="mt-1 text-xs text-zinc-500">
          Between {MIN_ITEM_COUNT} and {MAX_ITEM_COUNT}.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canContinue}
        >
          Next
        </button>
      </div>
    </form>
  );
}
