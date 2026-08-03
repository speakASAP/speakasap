'use client';

import { useState } from 'react';
import type { DrillTopicDTO } from '@/lib/drills/contracts';
import { TopicPicker, type SelectedTopic } from './TopicPicker';

export const DEFAULT_ITEM_COUNT = 50;
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
      onSubmit={(e) => {
        e.preventDefault();
        if (!canContinue) {
          return;
        }
        onNext({ topics: selected, instructions: instructions.trim(), count: parsedCount });
      }}
    >
      <TopicPicker topics={topics} selected={selected} onChange={setSelected} allowCreate />

      <label htmlFor="drill-instructions">Instructions</label>
      <textarea
        id="drill-instructions"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="Anything the generator should know — a focus, a context, mistakes to drill."
      />

      <label htmlFor="drill-count">Number of exercises</label>
      <input
        id="drill-count"
        type="number"
        min={MIN_ITEM_COUNT}
        max={MAX_ITEM_COUNT}
        value={count}
        onChange={(e) => setCount(e.target.value)}
      />

      <button type="submit" disabled={!canContinue}>
        Next
      </button>
    </form>
  );
}
