'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import {
  DrillApiError,
  createAssignmentItem,
  deleteAssignmentItem,
  getTeacherProgress,
  updateAssignmentItem,
  type TeacherProgress,
  type TeacherProgressBlank,
} from '@/lib/drills/teacher/api';
import { SentenceEditor, type EditedSentence } from '@/lib/drills/teacher/SentenceEditor';
import { parseToWords } from '@/lib/drills/sentence-editing';
import { GapAnalysisBlock } from '@/lib/drills/analysis/GapAnalysisBlock';

/**
 * What a student has done with one drill, and the teacher's chance to correct it.
 *
 * A teacher asked to see "what is finished and what are the errors there". Counts cannot
 * answer that, and the runner payload is deliberately answer-free — so this is the one
 * teacher-only view that shows the expected answer next to what the student typed.
 *
 * The sentence is shown whole rather than as a list of blank pairs: a bare
 * "совещания → meeting" gives no way to judge whether the blank tests the right thing.
 * Each blank carries the student's state inline, so the mistakes are read in the context
 * that produced them.
 */
export default function AssignmentProgressPage() {
  const params = useParams<{ uuid: string }>();
  const router = useRouter();
  const [progress, setProgress] = useState<TeacherProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** The sentence uuid being edited, or 'new' while adding. */
  const [editing, setEditing] = useState<string | null>(null);
  /**
   * Confirmation for actions that would otherwise finish invisibly — right now that is
   * only remedial-drill creation from the gap analysis below. The page had no banner
   * mechanism before this, so a click on "Создать работу над ошибками" changed a
   * database row the teacher had no way to see.
   */
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * COMPLETED and CANCELLED are terminal, and education-service refuses to edit an
   * assignment in either — they have no outgoing edge in the state machine, so a change
   * would rewrite finished history while the student's recorded result still described
   * questions that no longer exist.
   *
   * The page used to offer Edit, Delete and "Add sentence" regardless, so on a finished
   * drill every one of them failed with a bare "Request failed with status 409". Hiding
   * them is the honest version of the same rule: the server's answer has not changed,
   * the teacher just is not invited to discover it the hard way any more.
   */
  const locked = progress?.status === 'COMPLETED' || progress?.status === 'CANCELLED';

  const load = useCallback(async () => {
    if (!params?.uuid) {
      return;
    }
    // The notice describes one completed action. Any reload can invalidate it — most
    // concretely, deleting the last sentence brings back the "awaiting approval" banner,
    // which is also role="status", leaving two live regions on screen at once.
    setNotice(null);
    try {
      setProgress(await getTeacherProgress(params.uuid));
    } catch (e) {
      setError(e instanceof DrillApiError ? e.message : 'Could not load this drill');
    } finally {
      setLoading(false);
    }
  }, [params?.uuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const allBlanks = progress?.items.flatMap((item) => item.blanks) ?? [];
  const solved = allBlanks.filter((b) => b.solved).length;
  const revealed = allBlanks.filter((b) => b.revealed).length;
  const withMistakes = allBlanks.filter((b) => b.wrongAttempts.length > 0).length;

  /**
   * Every write re-fetches rather than patching state in place. Editing a sentence
   * clears its recorded attempts server-side, so the counts and badges on screen are
   * stale the moment a save succeeds — reconstructing them here would mean keeping a
   * second implementation of the server's reset rule in the browser.
   *
   * Errors are surfaced, never swallowed: the editor stays open holding the teacher's
   * work so nothing they typed is lost to a failed request.
   */
  const runWrite = async (write: () => Promise<unknown>): Promise<void> => {
    setError(null);
    await write();
    setEditing(null);
    await load();
  };

  const saveEdit = (itemUuid: string) => async (sentences: EditedSentence[]) => {
    await runWrite(() => updateAssignmentItem(itemUuid, sentences[0]));
  };

  const saveNew = async (sentences: EditedSentence[]): Promise<void> => {
    await runWrite(async () => {
      for (const sentence of sentences) {
        await createAssignmentItem(params.uuid, sentence);
      }
    });
  };

  const remove = async (itemUuid: string, position: number): Promise<void> => {
    // A student's answers to this sentence go with it, so this is not undoable from
    // the UI. Confirmed rather than offered as a bare button.
    if (!window.confirm(`Delete sentence ${position}? The student's answers to it are removed too.`)) {
      return;
    }
    setError(null);
    try {
      await deleteAssignmentItem(itemUuid);
      await load();
    } catch (e) {
      setError(e instanceof DrillApiError ? e.message : 'Could not delete this sentence');
    }
  };

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <button
          type="button"
          className="text-sm text-sky-700 underline hover:text-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-sky-400"
          onClick={() => router.back()}
        >
          ← Back
        </button>

        <h1 className="text-2xl font-semibold">{progress ? progress.title : 'Drill progress'}</h1>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}

        {notice ? (
          <p
            role="status"
            className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
          >
            {notice}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading progress">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        ) : null}

        {progress && progress.items.length === 0 ? (
          /*
           * Assignment items are copied from the set at APPROVAL, so a set still awaiting
           * review has none. Rendering the tiles here showed "0 / 0 Solved" over an empty
           * list, which reads as "the student did nothing" when in fact they have never
           * been able to start.
           *
           * ASSIGNED with no items is a different thing — the student has work with no
           * content, which is a defect — so it is not described with the reassuring
           * approval wording.
           */
          <p
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            {progress.status === 'PENDING_REVIEW'
              ? 'This set is still awaiting your approval, so the student has not started it yet. Approve it on the review screen and progress will appear here.'
              : 'This assignment has no sentences, so there is no progress to show. Please report it if it stays this way.'}
          </p>
        ) : null}

        {progress && progress.items.length > 0 ? (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              {[
                { label: 'Solved', value: `${solved} / ${allBlanks.length}` },
                { label: 'With mistakes', value: String(withMistakes) },
                { label: 'Revealed', value: String(revealed) },
                { label: 'Status', value: progress.status },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-lg font-semibold">{tile.value}</p>
                  <p className="text-xs text-zinc-500">{tile.label}</p>
                </div>
              ))}
            </section>

            <ol className="space-y-3">
              {progress.items.map((item, i) => (
                <li
                  key={item.uuid}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Sentence {i + 1}</p>
                    {locked ? null : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-label={`Edit sentence ${i + 1}`}
                          onClick={() => setEditing(item.uuid)}
                          className="text-xs text-sky-700 underline hover:text-sky-900 dark:text-sky-400"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete sentence ${i + 1}`}
                          onClick={() => void remove(item.uuid, i + 1)}
                          className="text-xs text-zinc-500 underline hover:text-red-700 dark:hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {editing === item.uuid ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Changing the words clears this sentence&rsquo;s answers, so the student
                        does it again. Their other sentences are untouched.
                      </p>
                      <SentenceEditor
                        mode="edit"
                        initialTemplate={item.template}
                        initialHint={item.hint}
                        onSave={saveEdit(item.uuid)}
                        onCancel={() => setEditing(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <SentenceLine template={item.template} blanks={item.blanks} index={i + 1} />

                      <ul className="mt-2 space-y-1">
                        {item.blanks
                          .filter((blank) => blank.wrongAttempts.length > 0)
                          .map((blank) => (
                            <li key={blank.index} className="text-xs text-red-700 dark:text-red-400">
                              {/* What they actually typed — the shape of the mistake is
                                  what a teacher acts on. */}
                              <span className="font-semibold">{blank.answer}</span> — tried:{' '}
                              {blank.wrongAttempts.join(', ')}
                            </li>
                          ))}
                      </ul>

                      {item.hint ? (
                        <p className="mt-2 text-xs text-zinc-500">{item.hint}</p>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ol>

            {locked ? (
              <p
                data-testid="locked-note"
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
              >
                This drill is finished, so its sentences can no longer be changed — the
                student&rsquo;s answers describe the questions as they were. To give them more
                practice, create a new drill.
              </p>
            ) : editing === 'new' ? (
              <SentenceEditor mode="add" onSave={saveNew} onCancel={() => setEditing(null)} />
            ) : (
              <button
                type="button"
                onClick={() => setEditing('new')}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Add sentence
              </button>
            )}
          </>
        ) : null}

        {params?.uuid ? (
          <GapAnalysisBlock
            assignmentUuid={params.uuid}
            audience="teacher"
            onRemedialCreated={(result) => {
              setNotice(
                result.reused
                  ? 'Работа над ошибками уже создана для этого пробела.'
                  : `Создано заданий: ${result.assignmentUuids.length}. Проверьте и отправьте студенту.`,
              );
            }}
          />
        ) : null}
      </div>
    </main>
  );
}

/**
 * One sentence with each blank's student state attached to the blank itself.
 *
 * The answer comes first and its translation trails it, matching the review screen: a
 * teacher judges whether the sentence is natural by reading the target language straight
 * through, which an interleaved prompt breaks.
 */
function SentenceLine({
  template,
  blanks,
  index,
}: {
  template: string | null | undefined;
  blanks: TeacherProgressBlank[];
  index: number;
}) {
  let blankCursor = 0;

  if (typeof template !== 'string' || template === '') {
    /*
     * An item with no template is a data defect. It is reported per sentence rather than
     * thrown, because throwing here took the whole page down to a blank screen — one bad
     * row cost the teacher every other sentence and every count on the assignment.
     *
     * The blanks are still listed: they carry the answers and the student's attempts,
     * which is most of what this screen exists to show.
     */
    console.error(
      `Drill progress: sentence ${index} has no template; rendering blanks only. This is a data defect.`,
    );
    return (
      <div data-testid={`sentence-${index}`} className="mt-2">
        <p className="text-xs text-red-700 dark:text-red-400">
          This sentence&rsquo;s text is missing, so only its blanks can be shown. Please report it.
        </p>
        <ul className="mt-1 space-y-1">
          {blanks.map((blank) => (
            <li key={blank.index} className="text-sm">
              <span className="font-semibold text-sky-700 dark:text-sky-400">{blank.answer}</span>{' '}
              <span className="text-zinc-500">[{blank.prompt}]</span>
              <BlankState blank={blank} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <p data-testid={`sentence-${index}`} className="mt-2 leading-loose">
      {parseToWords(template).map((word, i) => {
        if (!word.isBlank) {
          return <span key={i}>{word.text} </span>;
        }
        // Positional, matching how the server numbers blanks when it parses the same
        // template — `blanks[n]` is the nth blank in reading order.
        const blank = blanks[blankCursor++];
        return (
          <span key={i} className="whitespace-nowrap">
            <strong className="font-semibold text-sky-700 dark:text-sky-400">{word.text}</strong>{' '}
            <span className="text-zinc-500">[{word.prompt}]</span>
            <BlankState blank={blank} />{' '}
          </span>
        );
      })}
    </p>
  );
}

function BlankState({ blank }: { blank: TeacherProgressBlank | undefined }) {
  if (!blank) {
    // A template with more blanks than the stored `blanks` array is a data defect, not a
    // state to render silently as "not done".
    return (
      <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-900 dark:bg-red-950 dark:text-red-200">
        no data
      </span>
    );
  }
  if (blank.solved) {
    return (
      <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-900 dark:bg-green-950 dark:text-green-200">
        solved{blank.attemptCount > 1 ? ` after ${blank.attemptCount}` : ''}
      </span>
    );
  }
  if (blank.revealed) {
    return (
      <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        revealed
      </span>
    );
  }
  return (
    <span className="ml-1 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      not done
    </span>
  );
}
