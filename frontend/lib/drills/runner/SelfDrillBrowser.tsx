'use client';

import { useState } from 'react';

import { startSelfDrill } from './api';

export interface SelfDrillSet {
  uuid: string;
  title: string;
  itemCount: number;
}

export interface SelfDrillBrowserProps {
  /** The server's `selfDrillingAllowed`. Advisory: the server enforces the gate. */
  allowed: boolean;
  /** The assignment standing in the way, named so the message is actionable. */
  blockingTitle: string | null;
  sets: SelfDrillSet[];
  onStarted?: (assignmentUuid: string) => void;
}

/**
 * Browse approved sets and start self-drilling.
 *
 * `allowed` hides the list, but it is not the gate — the server is, and this flag can go
 * stale in a tab left open while a teacher assigns new work. So a 409 on start is treated
 * as a normal outcome to be displayed, not an error that breaks the page.
 */
export function SelfDrillBrowser({ allowed, blockingTitle, sets, onStarted }: SelfDrillBrowserProps) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  if (!allowed) {
    return (
      <section className="rounded border border-amber-300 bg-amber-50 p-4">
        <p>
          {blockingTitle
            ? `Finish your assignment "${blockingTitle}" before practising on your own.`
            : 'Finish your current assignment before practising on your own.'}
        </p>
      </section>
    );
  }

  async function start(setUuid: string) {
    if (starting) {
      return;
    }
    setStarting(setUuid);
    setError(null);
    try {
      const assignment = await startSelfDrill(setUuid);
      onStarted?.(assignment.uuid);
    } catch (caught) {
      const code = (caught as { code?: string })?.code;
      setError(
        code === 'ASSIGNMENT_OUTSTANDING'
          ? 'Your teacher has assigned new work. Finish that first, then come back.'
          : 'Could not start this drill. Please try again.',
      );
    } finally {
      setStarting(null);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">Practise on your own</h2>

      {error ? (
        <p role="alert" className="my-2 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {error}
        </p>
      ) : null}

      {sets.length === 0 ? (
        <p className="text-slate-600">No sets are available to practise yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sets.map((set) => (
            <li key={set.uuid} className="flex items-center justify-between rounded border p-3">
              <span>
                <span className="font-medium">{set.title}</span>{' '}
                <span className="text-sm text-slate-500">{set.itemCount} sentences</span>
              </span>
              <button
                type="button"
                className="rounded bg-sky-600 px-3 py-1 text-white disabled:opacity-50"
                disabled={starting !== null}
                onClick={() => void start(set.uuid)}
              >
                {starting === set.uuid ? 'Starting…' : 'Start'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
