'use client';

import type { ValidationIssue, ValidationState } from '@/lib/drills/contracts';

/**
 * One item in a set awaiting review, in the shape the review screen needs.
 *
 * Deliberately looser than `DrillSetItemDTO`: the review screen is also driven by a set
 * still being generated, where only the template, the hint and the validator's verdict
 * exist yet.
 */
export interface ReviewItemData {
  id: number;
  order: number;
  validationState: ValidationState;
  validationIssues: ValidationIssue[];
  item: { template: string; hint: string | null };
  suggestedFix?: { template: string; hint: string | null } | null;
}

export interface ReviewItemProps {
  data: ReviewItemData;
  /** The state as displayed, which is OVERRIDDEN once the teacher keeps a flagged item. */
  state: ValidationState;
  onOverride: (id: number) => void;
  onRegenerate: (id: number) => void;
  onApplySuggestion?: (id: number) => void;
  onEdit?: (id: number) => void;
}

const BLANK_PATTERN = /\[([^\]]*)\]\{([^}]*)\}/g;

export interface TemplateSegment {
  text: string;
  prompt: string | null;
  answer: string | null;
}

/**
 * Splits the markup into what the student sees and what only the teacher sees.
 *
 * The teacher needs both at once: the sentence as it will appear, to judge whether it
 * reads naturally, and the answer, to judge whether the blank tests the right thing. They
 * are separate segments rather than one interpolated string so the answer can be styled —
 * and so no code path can accidentally render the answer into the student-facing half.
 */
export function parseTemplate(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let cursor = 0;

  for (const match of template.matchAll(BLANK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ text: template.slice(cursor, index), prompt: null, answer: null });
    }
    segments.push({ text: '', prompt: match[1], answer: match[2] });
    cursor = index + match[0].length;
  }

  if (cursor < template.length) {
    segments.push({ text: template.slice(cursor), prompt: null, answer: null });
  }

  return segments;
}

export function ReviewItem({
  data,
  state,
  onOverride,
  onRegenerate,
  onApplySuggestion,
  onEdit,
}: ReviewItemProps) {
  const segments = parseTemplate(data.item.template);
  const flagged = state === 'FAIL' || state === 'WARN';

  return (
    <li
      className={`rounded-lg border bg-white p-4 dark:bg-zinc-900 ${
        flagged
          ? 'border-amber-300 dark:border-amber-800'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <span
        data-testid="review-item-state"
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
          flagged
            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
            : 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200'
        }`}
      >
        {state}
      </span>

      <p className="mt-2 leading-relaxed">
        {segments.map((segment, i) =>
          segment.answer === null ? (
            <span key={i}>{segment.text}</span>
          ) : (
            <span key={i}>
              <span className="text-zinc-500">[{segment.prompt}]</span>{' '}
              <strong className="font-semibold text-sky-700 dark:text-sky-400">
                {segment.answer}
              </strong>
            </span>
          ),
        )}
      </p>

      {data.item.hint ? (
        <p className="mt-1 text-sm text-zinc-500">{data.item.hint}</p>
      ) : null}

      {data.validationIssues.map((issue) => (
        <p
          key={issue.code}
          role="note"
          className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {issue.message}
        </p>
      ))}

      {flagged ? (
        <>
          {/*
            Present only when the validator actually returned a fix. A disabled
            "apply suggestion" on every item would read as though a fix exists and the
            screen is refusing to apply it.
          */}
          {data.suggestedFix && onApplySuggestion ? (
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => onApplySuggestion(data.id)}
            >
              Apply suggestion
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={() => onRegenerate(data.id)}
          >
            Regenerate
          </button>
          {onEdit ? (
            <button type="button" onClick={() => onEdit(data.id)}>
              Edit
            </button>
          ) : null}
          {/* Sets the state to OVERRIDDEN — recorded, never a silent clear. */}
          <button type="button" onClick={() => onOverride(data.id)}>
            Keep anyway
          </button>
        </>
      ) : null}
    </li>
  );
}
