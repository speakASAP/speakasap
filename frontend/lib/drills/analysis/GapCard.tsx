'use client';

import type { GapCluster } from '@/lib/drills/analysis/contracts';
import { remedialSentenceCount } from '@/lib/drills/analysis/api';

interface GapCardProps {
  cluster: GapCluster;
  /** Teachers create the remedial drill; students only read the theory. */
  showRemedialAction: boolean;
  onCreateRemedial?: (gapUuid: string) => void;
  busy?: boolean;
}

/**
 * One grammar gap: the rule, why the student's attempts broke it, and examples.
 *
 * The same card renders below a finished drill and at the top of the remedial drill it
 * produced — one row, one explanation, two places. Do not fork it for either audience;
 * the only difference is the action button, which is a prop.
 */
export function GapCard({ cluster, showRemedialAction, onCreateRemedial, busy }: GapCardProps) {
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

      {showRemedialAction ? (
        <button
          type="button"
          disabled={busy || sentenceCount === 0}
          onClick={() => onCreateRemedial?.(cluster.uuid)}
          className="mt-4 rounded bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Создать работу над ошибками ({sentenceCount} предложений)
        </button>
      ) : null}
    </section>
  );
}
