'use client';

import { useMemo, useState } from 'react';
import {
  buildTemplate,
  parseToWords,
  splitSentences,
  validateSentence,
  type EditableWord,
} from '@/lib/drills/sentence-editing';

/**
 * Writing and correcting drill sentences.
 *
 * A teacher supplies plain text — typed or pasted — and clicks the words a student must
 * fill in. Clicking is the whole interaction: the `[prompt]{answer}` markup is never
 * shown, because a teacher correcting a student's homework should not have to learn a
 * syntax to do it.
 *
 * One component serves both edit targets. A set awaiting review and a live assignment
 * store their sentences in different services, but the thing being edited is the same
 * sentence, so the rules and the interaction are shared and only `onSave` differs.
 */

export interface EditedSentence {
  template: string;
  hint: string | null;
}

export interface SentenceEditorProps {
  /** `edit` works on one existing sentence; `add` starts from a paste box. */
  mode: 'edit' | 'add';
  initialTemplate?: string;
  initialHint?: string | null;
  /** Rejecting here surfaces the reason; the editor stays open with the teacher's work. */
  onSave: (sentences: EditedSentence[]) => void | Promise<void>;
  onCancel: () => void;
}

interface SentenceDraft {
  id: number;
  words: EditableWord[];
  hint: string | null;
}

let nextId = 0;
const draftFrom = (template: string, hint: string | null): SentenceDraft => ({
  id: nextId++,
  words: parseToWords(template),
  hint,
});

export function SentenceEditor({
  mode,
  initialTemplate,
  initialHint = null,
  onSave,
  onCancel,
}: SentenceEditorProps) {
  const [drafts, setDrafts] = useState<SentenceDraft[]>(() =>
    mode === 'edit' && initialTemplate !== undefined
      ? [draftFrom(initialTemplate, initialHint)]
      : [],
  );
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Recomputed rather than stored: a validity flag kept in state can disagree with the
  // words it describes, and the disagreement always favours saving something broken.
  const validated = useMemo(
    () =>
      drafts.map((draft) => {
        const template = buildTemplate(draft.words);
        return { draft, template, issues: validateSentence(template) };
      }),
    [drafts],
  );

  const canSave =
    !saving && validated.length > 0 && validated.every((entry) => entry.issues.length === 0);

  const updateWords = (draftId: number, index: number, patch: Partial<EditableWord>): void => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              words: draft.words.map((word, i) => (i === index ? { ...word, ...patch } : word)),
            }
          : draft,
      ),
    );
  };

  /**
   * Turns a blank back into an ordinary word. The prompt is dropped with it so a stale
   * translation cannot reappear if the same word is marked again later.
   */
  const unmarkBlank = (draftId: number, index: number): void => {
    updateWords(draftId, index, { isBlank: false, prompt: '' });
  };

  const acceptPasted = (): void => {
    const sentences = splitSentences(pasted);
    if (sentences.length === 0) {
      setError('Type or paste at least one sentence.');
      return;
    }
    setError(null);
    setDrafts((current) => [...current, ...sentences.map((s) => draftFrom(s, null))]);
    setPasted('');
  };

  const save = async (): Promise<void> => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        validated.map((entry) => ({ template: entry.template, hint: entry.draft.hint })),
      );
    } catch (e) {
      // Never closed as though it worked: the teacher's typing is in this component and
      // nowhere else until the server accepts it.
      setError(e instanceof Error ? e.message : 'Could not save these sentences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {mode === 'add' ? (
        <div className="space-y-2">
          <label htmlFor="paste-box" className="block text-sm font-medium">
            Type or paste your sentences
          </label>
          <textarea
            id="paste-box"
            rows={4}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="One sentence per line, or ordinary prose — each sentence becomes its own drill."
            className="w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="button"
            onClick={acceptPasted}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Add these sentences
          </button>
        </div>
      ) : null}

      {validated.length > 0 ? (
        <p className="text-sm text-zinc-500">
          Click the words a student should fill in, then give each one its translation.
        </p>
      ) : null}

      <ol className="space-y-4">
        {validated.map(({ draft, template, issues }) => (
          <li
            key={draft.id}
            data-testid="sentence-row"
            className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-center gap-1">
              {draft.words.map((word, index) => (
                <button
                  key={index}
                  type="button"
                  aria-pressed={word.isBlank}
                  onClick={() =>
                    word.isBlank
                      ? unmarkBlank(draft.id, index)
                      : updateWords(draft.id, index, { isBlank: true })
                  }
                  className={`rounded px-1.5 py-0.5 text-sm transition-colors ${
                    word.isBlank
                      ? 'bg-sky-100 font-semibold text-sky-900 dark:bg-sky-950 dark:text-sky-200'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {word.text}
                </button>
              ))}
            </div>

            {draft.words.map((word, index) =>
              word.isBlank ? (
                <div key={index} className="flex items-center gap-2">
                  <label htmlFor={`prompt-${draft.id}-${index}`} className="text-xs text-zinc-500">
                    Translation for “{word.text}”
                  </label>
                  <input
                    id={`prompt-${draft.id}-${index}`}
                    value={word.prompt}
                    onChange={(e) => updateWords(draft.id, index, { prompt: e.target.value })}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                  {/* Clicking the word above unmarks it too, but a teacher removing a word
                      the student already knows looks for a control next to the translation
                      they are deleting, not for a second click on the sentence. */}
                  <button
                    type="button"
                    aria-label={`Remove the blank “${word.text}”`}
                    onClick={() => unmarkBlank(draft.id, index)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    Remove
                  </button>
                </div>
              ) : null,
            )}

            <p data-testid="sentence-preview" className="text-sm leading-relaxed">
              {parseToWords(template).map((word, i) =>
                word.isBlank ? (
                  <span key={i}>
                    <strong className="font-semibold text-sky-700 dark:text-sky-400">
                      {word.text}
                    </strong>{' '}
                    <span className="text-zinc-500">[{word.prompt}]</span>{' '}
                  </span>
                ) : (
                  <span key={i}>{word.text} </span>
                ),
              )}
            </p>

            {/* Stated per sentence rather than as one banner: with several rows on
                screen, "something is wrong" does not say which one. */}
            {issues.map((issue) => (
              <p key={issue.code} className="text-xs text-amber-700 dark:text-amber-400">
                {issue.message}
              </p>
            ))}

            {mode === 'add' ? (
              <button
                type="button"
                aria-label="Remove this sentence"
                onClick={() => setDrafts((c) => c.filter((d) => d.id !== draft.id))}
                className="text-xs text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Remove this sentence
              </button>
            ) : null}
          </li>
        ))}
      </ol>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="rounded-md bg-sky-700 px-3 py-1.5 text-sm text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
