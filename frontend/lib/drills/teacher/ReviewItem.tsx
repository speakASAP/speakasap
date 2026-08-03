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
    <li>
      <span data-testid="review-item-state">{state}</span>

      <p>
        {segments.map((segment, i) =>
          segment.answer === null ? (
            <span key={i}>{segment.text}</span>
          ) : (
            <span key={i}>
              [{segment.prompt}] <strong>{segment.answer}</strong>
            </span>
          ),
        )}
      </p>

      {data.item.hint ? <p>{data.item.hint}</p> : null}

      {data.validationIssues.map((issue) => (
        <p key={issue.code} role="note">
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
            <button type="button" onClick={() => onApplySuggestion(data.id)}>
              Apply suggestion
            </button>
          ) : null}
          <button type="button" onClick={() => onRegenerate(data.id)}>
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
