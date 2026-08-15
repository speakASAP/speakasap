'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DrillAssignmentDTO, RunnerItemDTO } from '@/lib/drills/contracts';

import { DrillBlank } from './DrillBlank';
import { checkBlank, revealBlank } from './api';

export interface DrillRunnerProps {
  assignment: DrillAssignmentDTO;
  items: RunnerItemDTO[];
  onComplete: () => void;
}

interface BlankState {
  value: string;
  solved: boolean;
  solvedText: string | null;
  wrong: boolean;
  pending: boolean;
  /** The server's nudge after a wrong answer. Never derived here — see the service. */
  hint: string | null;
  /**
   * True once the server's hint offers a reveal. Driven by the hint text rather than a
   * local attempt count so the escalation lives in one place — the service that knows
   * the answer.
   */
  canReveal: boolean;
}

function blankKey(itemUuid: string, index: number): string {
  return `${itemUuid}:${index}`;
}

function initialState(items: RunnerItemDTO[]): Record<string, BlankState> {
  const state: Record<string, BlankState> = {};
  for (const item of items) {
    for (const blank of item.blanks) {
      state[blankKey(item.uuid, blank.index)] = {
        value: '',
        solved: blank.solved,
        solvedText: blank.solvedText,
        wrong: false,
        pending: false,
        hint: null,
        canReveal: false,
      };
    }
  }
  return state;
}

/**
 * The drill runner: type into a blank, and if it is right it becomes part of the sentence.
 *
 * Three rules drive the design, and each has a test that fails if it is broken.
 *
 * 1. Completion is the server's decision. `onComplete` fires on `assignmentCompleted`,
 *    never on a local count of solved blanks — the assignment may span items this
 *    component was not given.
 * 2. Progress is the server's count. `blanksCorrect`/`blanksTotal` come from the response;
 *    counting locally would disagree with the server the moment either is true.
 * 3. A transport failure is not a wrong answer. `NetworkError` produces "not saved",
 *    leaving the input untouched and editable, because the student did nothing wrong.
 */
export function DrillRunner({ assignment, items, onComplete }: DrillRunnerProps) {
  const [blanks, setBlanks] = useState<Record<string, BlankState>>(() => initialState(items));
  const [progress, setProgress] = useState({
    correct: assignment.blanksCorrect,
    total: assignment.blanksTotal,
  });
  const [announcement, setAnnouncement] = useState('');

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const completed = useRef(false);
  // Guards against the debounced check and an Enter press both firing for one edit.
  const inFlight = useRef<Record<string, boolean>>({});
  // The value each blank was last graded on. Blur fires whenever the student leaves a
  // field, but leaving a field is not answering it: without this, tabbing past a wrong
  // blank re-posted the same answer and the server counted another wrong attempt each
  // time, escalating hints for a student who had tried once.
  const lastChecked = useRef<Record<string, string>>({});

  useEffect(() => {
    setBlanks(initialState(items));
    // New sentences mean new blanks behind the same keys; a value graded for the old set
    // must not suppress the first check of the new one.
    lastChecked.current = {};
  }, [items]);

  const order = useMemo(
    () =>
      [...items]
        .sort((a, b) => a.order - b.order)
        .flatMap((item) => item.blanks.map((blank) => blankKey(item.uuid, blank.index))),
    [items],
  );

  const focusNextUnsolved = useCallback(
    (fromKey: string, solvedKeys: Record<string, BlankState>) => {
      const start = order.indexOf(fromKey);
      for (const key of order.slice(start + 1).concat(order.slice(0, start))) {
        if (!solvedKeys[key]?.solved) {
          inputs.current[key]?.focus();
          return;
        }
      }
    },
    [order],
  );

  const submit = useCallback(
    async (itemUuid: string, index: number) => {
      const key = blankKey(itemUuid, index);
      const current = blanks[key];
      if (!current || current.solved || inFlight.current[key]) {
        return;
      }
      const value = current.value.trim();
      if (!value || lastChecked.current[key] === value) {
        return;
      }

      // Recorded before the request, not after: two blurs in quick succession would both
      // read an unset entry otherwise, and the second is exactly the duplicate attempt
      // this guard exists to stop.
      lastChecked.current[key] = value;
      inFlight.current[key] = true;
      setBlanks((prev) => ({ ...prev, [key]: { ...prev[key], pending: true, wrong: false } }));

      // One retry, because a single dropped request is the common case and asking the
      // student to retype a correct answer over it is the wrong trade.
      const attempt = () => checkBlank(assignment.uuid, { itemUuid, blankIndex: index, value });

      try {
        let response;
        try {
          response = await attempt();
        } catch (error) {
          if ((error as Error)?.name !== 'NetworkError') {
            throw error;
          }
          response = await attempt();
        }

        setBlanks((prev) => {
          const next = {
            ...prev,
            [key]: {
              ...prev[key],
              pending: false,
              solved: response.correct,
              solvedText: response.correct ? response.acceptedText : null,
              wrong: !response.correct,
              // Cleared on success: a solved blank has nothing left to nudge towards.
              hint: response.correct ? null : ((response as { hint?: string | null }).hint ?? null),
              canReveal:
                !response.correct &&
                Boolean((response as { hint?: string | null }).hint?.includes('показать')),
            },
          };
          if (response.correct) {
            queueMicrotask(() => focusNextUnsolved(key, next));
          }
          return next;
        });

        setProgress({ correct: response.blanksCorrect, total: response.blanksTotal });
        setAnnouncement(response.correct ? `Correct: ${response.acceptedText}` : 'Not quite — try again');

        if (response.assignmentCompleted && !completed.current) {
          completed.current = true;
          onComplete();
        }
      } catch (error) {
        const isNetwork = (error as Error)?.name === 'NetworkError';
        // Nothing was graded, so the same value must stay retryable — the guard above is
        // about not counting an answer twice, never about refusing one that never landed.
        delete lastChecked.current[key];
        // A wrong answer is the student's; a dropped connection is ours. Only the former
        // marks the input invalid.
        setBlanks((prev) => ({
          ...prev,
          [key]: { ...prev[key], pending: false, wrong: !isNetwork },
        }));
        setAnnouncement(
          isNetwork
            ? 'Not saved — check your connection and try again'
            : 'Something went wrong. Your answer was not saved',
        );
      } finally {
        inFlight.current[key] = false;
      }
    },
    [assignment.uuid, blanks, focusNextUnsolved, onComplete],
  );

  /**
   * Show the answer for one blank, at the student's explicit request.
   *
   * The response carries `acceptedText` even though `correct` is false — the only place
   * that happens — so the blank renders as resolved text exactly like a solved one.
   */
  const reveal = useCallback(
    async (itemUuid: string, index: number) => {
      const key = blankKey(itemUuid, index);
      setBlanks((prev) => ({ ...prev, [key]: { ...prev[key], pending: true } }));
      try {
        const response = await revealBlank(assignment.uuid, itemUuid, index);
        setBlanks((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            pending: false,
            solved: true,
            solvedText: response.acceptedText,
            wrong: false,
            hint: null,
            canReveal: false,
          },
        }));
        setProgress({ correct: response.blanksCorrect, total: response.blanksTotal });
        setAnnouncement(`Ответ: ${response.acceptedText}`);

        // Revealing the last blank finishes the drill exactly as answering it does — the
        // server decides completion from blanksResolved, which counts reveals. Without
        // this the student saw nothing about the error analysis until a manual reload,
        // because `onComplete` was only ever reachable through `check`.
        if (response.assignmentCompleted && !completed.current) {
          completed.current = true;
          onComplete();
        }
      } catch {
        setBlanks((prev) => ({ ...prev, [key]: { ...prev[key], pending: false } }));
        setAnnouncement('Не удалось показать ответ. Попробуйте ещё раз.');
      }
    },
    [assignment.uuid, onComplete],
  );

  /**
   * Typing only records the value — it never checks.
   *
   * Checking used to be debounced at 250 ms, so every pause while typing was graded:
   * "geg", "gesp", "gespro" counted as three wrong attempts from a student who had made
   * none. That also drove the hint escalation, offering to reveal the answer before the
   * first real try was finished. The check now happens on blur or Enter, when the
   * student has actually decided what their answer is.
   */
  const change = useCallback((itemUuid: string, index: number, value: string) => {
    const key = blankKey(itemUuid, index);
    setBlanks((prev) => ({ ...prev, [key]: { ...prev[key], value, wrong: false, hint: null } }));
  }, []);

  return (
    <section aria-labelledby="drill-title">
      <h1 id="drill-title" className="text-xl font-semibold">
        {assignment.title}
      </h1>

      <div
        role="progressbar"
        aria-valuenow={progress.correct}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-label="Blanks completed"
        className="my-4 h-2 w-full overflow-hidden rounded bg-slate-200"
      >
        <div
          className="h-full bg-green-600 transition-[width]"
          style={{ width: progress.total ? `${(progress.correct / progress.total) * 100}%` : '0%' }}
        />
      </div>

      <ol className="space-y-6">
        {[...items]
          .sort((a, b) => a.order - b.order)
          .map((item, itemPosition) => (
            <li key={item.uuid} className="text-lg leading-loose">
              {item.segments.map((segment, segmentIndex) => {
                if (segment.type === 'text') {
                  return <span key={segmentIndex}>{segment.value}</span>;
                }
                const key = blankKey(item.uuid, segment.index);
                const state = blanks[key];
                const blank = item.blanks.find((candidate) => candidate.index === segment.index);
                if (!state || !blank) {
                  return null;
                }
                return (
                  <DrillBlank
                    key={key}
                    ref={(element) => {
                      inputs.current[key] = element;
                    }}
                    label={`Sentence ${itemPosition + 1}, blank ${segment.index + 1}`}
                    prompt={blank.prompt}
                    maxLength={blank.maxLength}
                    value={state.value}
                    solved={state.solved}
                    solvedText={state.solvedText}
                    wrong={state.wrong}
                    pending={state.pending}
                    onChange={(value) => change(item.uuid, segment.index, value)}
                    onSubmit={() => void submit(item.uuid, segment.index)}
                  />
                );
              })}
              {item.hint ? <p className="mt-1 text-sm text-slate-500">{item.hint}</p> : null}

              {/*
                The server's nudge after a wrong answer — length, then first letter, then
                an offer to reveal. Shown per item, under the sentence it belongs to.
                role="status" so a screen reader hears it without losing the input focus.
              */}
              {item.blanks
                .map((blank) => blanks[blankKey(item.uuid, blank.index)])
                .filter((state): state is BlankState => Boolean(state?.hint))
                .map((state, i) => (
                  <p
                    key={i}
                    role="status"
                    className="mt-1 text-sm text-amber-700 dark:text-amber-400"
                  >
                    {state.hint}
                    {state.canReveal ? (
                      <button
                        type="button"
                        className="ml-2 rounded border border-amber-400 px-2 py-0.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-300 dark:hover:bg-amber-950"
                        onClick={() => {
                          const blank = item.blanks.find(
                            (b) => blanks[blankKey(item.uuid, b.index)] === state,
                          );
                          if (blank) {
                            void reveal(item.uuid, blank.index);
                          }
                        }}
                      >
                        Показать ответ
                      </button>
                    ) : null}
                  </p>
                ))}
            </li>
          ))}
      </ol>

      <p role="status" aria-live="polite" className="sr-only mt-4 text-sm">
        {announcement}
      </p>
    </section>
  );
}
