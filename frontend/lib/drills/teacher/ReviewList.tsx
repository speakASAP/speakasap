'use client';

import { useMemo, useRef, useState } from 'react';
import type { ValidationState } from '@/lib/drills/contracts';
import { ReviewItem, type ReviewItemData } from './ReviewItem';

export interface ReviewListProps {
  items: ReviewItemData[];
  onApprove: () => void;
  onRegenerate?: (itemIds: number[]) => void;
  onOverride?: (itemId: number) => void;
  onApplySuggestion?: (itemId: number) => void;
  onEdit?: (itemId: number) => void;
  onDelete?: (itemId: number) => void;
  /** The item currently being edited, if any, and the editor to render in its place. */
  editingItemId?: number | null;
  renderEditor?: (item: ReviewItemData) => React.ReactNode;
  /** Rendered under the list — the "Add sentence" affordance. */
  footer?: React.ReactNode;
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
  onDelete,
  editingItemId = null,
  renderEditor,
  footer,
}: ReviewListProps) {
  const [overridden, setOverridden] = useState<number[]>([]);

  const stateOf = (item: ReviewItemData): ValidationState =>
    overridden.includes(item.id) ? 'OVERRIDDEN' : item.validationState;

  /**
   * Where each item sits, decided once and then held.
   *
   * The worst-first sort is a reading order for a teacher arriving at the screen, not a
   * live ranking. Re-sorting while they work moves the row under their cursor: editing a
   * FAIL turns it PASS, which sent it to the bottom of the list the instant it was
   * saved, so the sentence they had just fixed left the viewport and a different one
   * took its place. Overriding did the same thing.
   *
   * So position is assigned on an item's first appearance and kept for the life of the
   * screen. Items added later (Add sentence) land after everything already placed, which
   * is where a teacher who just typed one expects to find it. A reload re-sorts, which is
   * the right moment for it: nothing is mid-edit.
   */
  const placement = useRef(new Map<number, number>());
  const nextPlacement = useRef(0);

  const ordered = useMemo(() => {
    const stateRank = (item: ReviewItemData): number =>
      STATE_ORDER[overridden.includes(item.id) ? 'OVERRIDDEN' : item.validationState] ?? 9;
    // Deliberately not `stateOf`: this runs inside useMemo, whose dependency list is
    // `[items, overridden]`, and reading the closure-captured helper instead would tie
    // placement to a value the memo does not track.

    // First render places everything by the worst-first rule; later renders only place
    // items this screen has not seen before, appending them after the existing rows.
    const unplaced = items.filter((item) => !placement.current.has(item.id));
    if (unplaced.length > 0) {
      const sorted = [...unplaced].sort((a, b) => {
        const byState = stateRank(a) - stateRank(b);
        return byState !== 0 ? byState : a.order - b.order;
      });
      for (const item of sorted) {
        placement.current.set(item.id, nextPlacement.current++);
      }
    }

    return [...items].sort(
      (a, b) => (placement.current.get(a.id) ?? 0) - (placement.current.get(b.id) ?? 0),
    );
    // `overridden` participates only so a newly overridden item is ranked correctly if it
    // is being placed for the first time; already-placed items keep their position.
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
            onDelete={onDelete}
            editor={editingItemId === item.id ? renderEditor?.(item) : undefined}
          />
        ))}
      </ul>

      {footer}

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
