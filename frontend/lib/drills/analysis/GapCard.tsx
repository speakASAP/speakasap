'use client';

import Link from 'next/link';

import type { GapCluster } from '@/lib/drills/analysis/contracts';
import { remedialSentenceCount } from '@/lib/drills/analysis/api';

interface GapCardProps {
  cluster: GapCluster;
  /** Teachers create the remedial drill; students only read the theory. */
  showRemedialAction: boolean;
  onCreateRemedial?: (gapUuid: string) => void;
  busy?: boolean;
  /**
   * The outcome of this card's own remedial creation, rendered next to the button.
   *
   * The page-level banner sits at the top of a long progress page, far above the button —
   * a teacher who clicked saw nothing happen and clicked again. Feedback belongs where
   * the click was.
   *
   * `assignmentUuids` carries the drills that were created (or found), because a remedial
   * drill starts in PENDING_REVIEW: it exists but the student cannot see it until the
   * teacher approves it. The confirmation therefore has to hand back the way to do that.
   */
  result?: { reused: boolean; count: number; assignmentUuids: string[] } | null;
  error?: string | null;
}

/**
 * One grammar gap: the rule, why the student's attempts broke it, and examples.
 *
 * The same card renders below a finished drill and at the top of the remedial drill it
 * produced — one row, one explanation, two places. Do not fork it for either audience;
 * the only difference is the action button, which is a prop.
 */
export function GapCard({
  cluster,
  showRemedialAction,
  onCreateRemedial,
  busy,
  result = null,
  error = null,
}: GapCardProps) {
  // A cluster the analyzer never wrote text for — the fallback bucket for answers no
  // cluster claimed. Its topic slug is all there is, and showing an empty card would be
  // worse than showing the slug.
  const heading = cluster.title || cluster.topicSlug;
  const sentenceCount = remedialSentenceCount(cluster);

  return (
    <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold">{heading}</h3>

      {cluster.explanation ? (
        <p className="mt-2 whitespace-pre-line text-zinc-800 dark:text-zinc-200">
          {cluster.explanation}
        </p>
      ) : null}

      {cluster.rules.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-zinc-800 dark:text-zinc-200">
          {cluster.rules.map((rule, index) => (
            <li key={index}>{rule}</li>
          ))}
        </ul>
      ) : null}

      {cluster.examples.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {cluster.examples.map((example, index) => (
            <li key={index}>
              <span className="font-medium">{example.text}</span>{' '}
              <span className="text-zinc-600 dark:text-zinc-400">{example.gloss}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {cluster.failedAnswers.length > 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {cluster.failedAnswers
            .map((answer) => `${answer.answer} (${answer.mistakeCount})`)
            .join(', ')}
        </p>
      ) : null}

      {/*
        The full theory on speakasap.com. Absent for most topics — only six languages have
        a grammar section — so it is rendered only when the server supplied one. A link
        built here from the slug would 404 for everything else.
      */}
      {cluster.topicUrl ? (
        <p className="mt-3">
          <a
            href={cluster.topicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-sky-700 underline hover:text-sky-900 dark:text-sky-400"
          >
            Разобрать тему на speakasap.com →
          </a>
        </p>
      ) : null}

      {showRemedialAction ? (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={busy || sentenceCount === 0}
            aria-busy={busy}
            onClick={() => onCreateRemedial?.(cluster.uuid)}
            className="rounded bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy
              ? 'Создаём работу над ошибками…'
              : `Создать работу над ошибками (${sentenceCount} предложений)`}
          </button>

          {/* Both outcomes render HERE, beside the button, not only in the page banner. */}
          {error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}

          {result && !error ? (
            <div role="status" className="space-y-1 text-sm text-green-700 dark:text-green-400">
              <p>
                {result.reused
                  ? 'Работа над ошибками уже создана для этого пробела.'
                  : `Готово. Создано заданий: ${result.count}. Проверьте и отправьте студенту.`}
              </p>

              {/*
                The created drill is PENDING_REVIEW — it exists, and the student cannot see
                it until it is approved. "Проверьте и отправьте студенту" described that
                without saying where, so the teacher had to guess the review URL. One link
                per created drill, because a gap can produce more than one.

                The reused case needs this most: nothing was created just now, so the only
                trace of the waiting drill was this sentence.
              */}
              {result.assignmentUuids.map((assignmentUuid) => (
                <p key={assignmentUuid}>
                  <Link
                    href={`/teacher/assignments/${assignmentUuid}/review`}
                    className="underline hover:text-green-900 dark:hover:text-green-300"
                  >
                    Проверить и отправить студенту →
                  </Link>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
