'use client';

import { useMemo, useState } from 'react';
import type { ValidationState } from '@/lib/drills/contracts';
import { ReviewItem, type ReviewItemData } from './ReviewItem';

export interface ReviewListProps {
  items: ReviewItemData[];
  onApprove: () => void;
  onRegenerate?: (itemIds: number[]) => void;
  onOverride?: (itemId: number) => void;
  onApplySuggestion?: (itemId: number) => void;
  onEdit?: (itemId: number) => void;
}

/**
 * Worst first. A teacher reviewing fifty sentences reads from the top and stops; the
 * items that need a decision have to be the ones they see.
 */
const STATE_ORDER: Record<string, number> = {
  FAIL: 0,
  WARN: 1,
  OVERRIDDEN: 2,
  PENDING: 3,
  PASS: 4,
};

/**
 * The review screen for a generated set.
 *
 * Approve is blocked while any FAIL is unresolved — approving a set the validator says is
 * broken is the one action here that reaches a student. A WARN does not block: it is
 * advisory, and gating on it would make the validator's softest signal as expensive as its
 * hardest.
 *
 * "Keep anyway" resolves a FAIL by moving it to OVERRIDDEN, which is recorded rather than
 * cleared. The distinction matters after the fact: a set approved over three overrides is
 * a different thing from a set that passed clean, and the bank needs to be able to tell
 * them apart.
 *
 * No score appears on this screen. Not per item, not in aggregate.
 */
export function ReviewList({
  items,
  onApprove,
  onRegenerate,
  onOverride,
  onApplySuggestion,
  onEdit,
}: ReviewListProps) {
  const [overridden, setOverridden] = useState<number[]>([]);

  const stateOf = (item: ReviewItemData): ValidationState =>
    overridden.includes(item.id) ? 'OVERRIDDEN' : item.validationState;

  const ordered = useMemo(() => {
    return [...items].sort((a, b) => {
      const byState = (STATE_ORDER[stateOf(a)] ?? 9) - (STATE_ORDER[stateOf(b)] ?? 9);
      return byState !== 0 ? byState : a.order - b.order;
    });
    // `overridden` participates because overriding an item re-sorts it out of the top.
  }, [items, overridden]);

  const flaggedIds = items
    .filter((item) => {
      const state = stateOf(item);
      return state === 'FAIL' || state === 'WARN';
    })
    .map((item) => item.id);

  const hasUnresolvedFailure = items.some((item) => stateOf(item) === 'FAIL');

  const override = (id: number) => {
    setOverridden((prev) => (prev.includes(id) ? prev : [...prev, id]));
    onOverride?.(id);
  };

  return (
    <section className="space-y-4">
      {ordered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          This set has no items yet.
        </p>
      ) : null}

      <ul className="space-y-3">
        {ordered.map((item) => (
          <ReviewItem
            key={item.id}
            data={item}
            state={stateOf(item)}
            onOverride={override}
            onRegenerate={(id) => onRegenerate?.([id])}
            onApplySuggestion={onApplySuggestion}
            onEdit={onEdit}
          />
        ))}
      </ul>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end dark:border-zinc-800">
        {flaggedIds.length > 0 && onRegenerate ? (
          <button
            type="button"
            className="rounded-md border border-amber-400 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-300 dark:hover:bg-amber-950"
            onClick={() => onRegenerate(flaggedIds)}
          >
            Regenerate all flagged ({flaggedIds.length})
          </button>
        ) : null}

        <button
          type="button"
          className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={hasUnresolvedFailure}
          onClick={onApprove}
        >
          Approve
        </button>
      </div>

      {hasUnresolvedFailure ? (
        <p className="text-right text-xs text-zinc-500">
          Resolve the flagged items before approving.
        </p>
      ) : null}
    </section>
  );
}
