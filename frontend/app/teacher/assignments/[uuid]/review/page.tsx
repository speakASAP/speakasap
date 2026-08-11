'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { DrillSetDetailDTO } from '@/lib/drills/contracts';
import {
  DrillApiError,
  approveSet,
  createSetItem,
  deleteSetItem,
  getAssignment,
  getSet,
  regenerateItems,
  updateSetItem,
} from '@/lib/drills/teacher/api';
import { safeReturnUrl } from '@/lib/drills/teacher/safe-return-url';
import { ReviewList } from '@/lib/drills/teacher/ReviewList';
import type { ReviewItemData } from '@/lib/drills/teacher/ReviewItem';
import { SentenceEditor, type EditedSentence } from '@/lib/drills/teacher/SentenceEditor';

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
  const searchParams = useSearchParams();

  const [set, setSet] = useState<DrillSetDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** The set item being edited, or 'new' while adding sentences. */
  const [editing, setEditing] = useState<number | 'new' | null>(null);

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
      // Back where the teacher came from, when the portal told us: they opened this
      // from a student's lesson page and expect to land back on that card, not on a
      // platform index they never asked for. Absolute, because it is another host —
      // and only honoured for the hosts we know.
      const returnTo = safeReturnUrl(searchParams.get('returnTo'));
      if (returnTo) {
        window.location.href = returnTo;
        return;
      }
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

  /**
   * Sentence writes all return the updated set, so the screen is refreshed from the
   * server's answer rather than patched locally — editing a template re-runs validation
   * upstream, and guessing the new state here would eventually disagree with it.
   *
   * Errors propagate to `SentenceEditor`, which keeps the teacher's work on screen and
   * shows the reason. Swallowing one would silently discard their typing.
   */
  const saveEdit = (itemId: number) => async (sentences: EditedSentence[]) => {
    if (!set) {
      return;
    }
    setError(null);
    setSet(await updateSetItem(set.uuid, itemId, sentences[0]));
    setEditing(null);
  };

  const saveNew = async (sentences: EditedSentence[]) => {
    if (!set) {
      return;
    }
    setError(null);
    let latest = set;
    for (const sentence of sentences) {
      latest = await createSetItem(set.uuid, sentence);
    }
    setSet(latest);
    setEditing(null);
  };

  const removeItem = async (itemId: number) => {
    if (!set) {
      return;
    }
    const position = (set.items ?? []).find((row) => row.id === itemId)?.order;
    if (!window.confirm(`Delete sentence ${(position ?? 0) + 1} from this set?`)) {
      return;
    }
    setError(null);
    try {
      setSet(await deleteSetItem(set.uuid, itemId));
    } catch (e) {
      setError(e instanceof DrillApiError ? e.message : 'Could not delete this sentence');
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
            onEdit={(id) => setEditing(id)}
            onDelete={(id) => void removeItem(id)}
            editingItemId={typeof editing === 'number' ? editing : null}
            renderEditor={(item) => (
              <SentenceEditor
                mode="edit"
                initialTemplate={item.item.template}
                initialHint={item.item.hint}
                onSave={saveEdit(item.id)}
                onCancel={() => setEditing(null)}
              />
            )}
            footer={
              editing === 'new' ? (
                <SentenceEditor mode="add" onSave={saveNew} onCancel={() => setEditing(null)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing('new')}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Add sentence
                </button>
              )
            }
          />
        ) : null}
      </div>
    </main>
  );
}
