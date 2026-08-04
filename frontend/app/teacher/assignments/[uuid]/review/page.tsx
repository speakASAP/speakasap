'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { DrillSetDetailDTO } from '@/lib/drills/contracts';
import {
  DrillApiError,
  approveSet,
  getAssignment,
  getSet,
  regenerateItems,
  updateSetItem,
} from '@/lib/drills/teacher/api';
import { ReviewList } from '@/lib/drills/teacher/ReviewList';
import type { ReviewItemData } from '@/lib/drills/teacher/ReviewItem';

/**
 * Approve what a student will see.
 *
 * Reached from the wizard once generation is READY, and from the library when a set is
 * still PENDING_REVIEW. Both arrive by assignment uuid, so the set is resolved through the
 * assignment rather than being passed in.
 */
export default function ReviewPage() {
  const params = useParams<{ uuid: string }>();
  const router = useRouter();

  const [set, setSet] = useState<DrillSetDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const assignment = await getAssignment(params.uuid);
      setSet(await getSet(assignment.setUuid));
    } catch (e) {
      setError(e instanceof DrillApiError ? e.message : 'Could not load the set');
    } finally {
      setLoading(false);
    }
  }, [params.uuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const items: ReviewItemData[] = (set?.items ?? []).map((setItem) => ({
    id: setItem.id,
    order: setItem.order,
    validationState: setItem.validationState,
    validationIssues: setItem.validationIssues,
    item: { template: setItem.item.template, hint: setItem.item.hint },
  }));

  const approve = async () => {
    if (!set) {
      return;
    }
    setError(null);
    try {
      await approveSet(set.uuid);
      router.push('/teacher/assignments');
    } catch (e) {
      // UNRESOLVED_VALIDATION_FAILURES is the server re-checking what the button already
      // gates on. Surfacing its message rather than a generic failure tells the teacher
      // which of the two views of the set is stale.
      setError(e instanceof DrillApiError ? e.message : 'Could not approve the set');
    }
  };

  const regenerate = async (itemIds: number[]) => {
    if (!set) {
      return;
    }
    try {
      setSet(await regenerateItems(set.uuid, itemIds));
    } catch (e) {
      setError(e instanceof DrillApiError ? e.message : 'Could not regenerate');
    }
  };

  const override = async (itemId: number) => {
    if (!set) {
      return;
    }
    try {
      // Persisted, not just reflected in the UI: an override is a decision the bank keeps.
      await updateSetItem(set.uuid, itemId, { validationState: 'OVERRIDDEN' });
    } catch (e) {
      setError(e instanceof DrillApiError ? e.message : 'Could not record the override');
    }
  };

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <button
          type="button"
          className="text-sm text-sky-700 underline hover:text-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-sky-400"
          onClick={() => router.back()}
        >
          ← Back
        </button>

        <h1 className="text-2xl font-semibold">{set ? set.title : 'Review'}</h1>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading the set">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        ) : null}

        {set ? (
          <ReviewList
            items={items}
            onApprove={() => void approve()}
            onRegenerate={(ids) => void regenerate(ids)}
            onOverride={(id) => void override(id)}
          />
        ) : null}
      </div>
    </main>
  );
}
