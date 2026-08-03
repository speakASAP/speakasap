'use client';

import { forwardRef } from 'react';

export interface DrillBlankProps {
  /** Accessible name, e.g. "sentence 3, blank 2". Blanks are visually identical otherwise. */
  label: string;
  prompt: string;
  maxLength: number;
  value: string;
  solved: boolean;
  solvedText: string | null;
  /** Set after a server-confirmed wrong answer. Never set for a transport failure. */
  wrong: boolean;
  pending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * One blank: an input until the server accepts it, then the student's own words as text.
 *
 * The resolved form is a `<span>` rather than a disabled input so the finished sentence
 * reads as a sentence — to a screen reader as much as to the eye. That is the whole point
 * of the exercise, so it is worth not being a greyed-out form control.
 */
export const DrillBlank = forwardRef<HTMLInputElement, DrillBlankProps>(function DrillBlank(
  { label, prompt, maxLength, value, solved, solvedText, wrong, pending, onChange, onSubmit },
  ref,
) {
  if (solved) {
    return (
      <span className="font-semibold text-green-700" data-solved="true">
        {solvedText}
      </span>
    );
  }

  return (
    <input
      ref={ref}
      type="text"
      aria-label={label}
      placeholder={prompt}
      maxLength={maxLength}
      value={value}
      // Sized from the character budget, which the server derives from the answer's
      // length and never from its text.
      size={Math.max(maxLength, 4)}
      aria-invalid={wrong ? 'true' : undefined}
      aria-busy={pending ? 'true' : undefined}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      className={`mx-1 inline-block rounded border-b-2 bg-transparent px-1 text-center outline-none ${
        wrong ? 'border-red-500 text-red-700' : 'border-slate-400 focus:border-sky-500'
      }`}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onSubmit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSubmit();
        }
      }}
    />
  );
});
