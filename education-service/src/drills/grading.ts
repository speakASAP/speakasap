import { DrillBlank } from './contracts';

export interface GradingOptions {
  caseSensitive: boolean;
}

export interface GradeResult {
  correct: boolean;
  acceptedText: string | null;
}

/** Languages where capitalization is semantically load-bearing. */
const CASE_SENSITIVE_LANGUAGES = new Set(['de']);

export function gradingOptionsFor(languageCode: string): GradingOptions {
  return { caseSensitive: CASE_SENSITIVE_LANGUAGES.has(languageCode) };
}

export function normalizeAnswer(value: string, opts: GradingOptions): string {
  let out = value
    .normalize('NFC')
    // Apostrophe lookalikes real keyboards and mobile autocorrect produce:
    // U+2018/U+2019 curly quotes, U+02BC modifier letter, U+00B4 acute accent,
    // U+0060 grave accent, U+2032 prime.
    .replace(/[‘’ʼ´`′]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]$/, '')
    .trim();
  if (!opts.caseSensitive) out = out.toLowerCase();
  return out;
}

/**
 * Grade one submitted value against one persisted blank.
 *
 * `blank` comes from `DrillAssignmentItem.blanks`, an unvalidated `Json` column
 * written by AI generation in Tracks C/D — its runtime shape is NOT guaranteed to
 * match `DrillBlank`. This function therefore treats a malformed blank as
 * **ungradeable** and returns `{ correct: false, acceptedText: null }` rather than
 * throwing a 500 into the student's check request:
 *
 * - non-string `answer` (null, missing, number) -> ungradeable, nothing accepted
 * - missing / non-array `alternatives`          -> treated as `[]`
 * - non-string entries inside `alternatives`    -> skipped
 *
 * That return value is the safe failure mode in both directions: it never tells a
 * student they are right, and it never reveals anything about the expected answer.
 * A blank stuck ungradeable shows up as a student who cannot make progress, which
 * is a visible bug — unlike a silent accept.
 */
export function gradeBlank(
  value: string,
  blank: DrillBlank,
  opts: GradingOptions,
): GradeResult {
  const submitted = normalizeAnswer(value, opts);
  if (submitted.length === 0) return { correct: false, acceptedText: null };

  const answer: unknown = blank?.answer;
  if (typeof answer !== 'string') return { correct: false, acceptedText: null };

  const rawAlternatives: unknown = blank.alternatives;
  const alternatives = Array.isArray(rawAlternatives)
    ? rawAlternatives.filter((a): a is string => typeof a === 'string')
    : [];

  const accepted = [answer, ...alternatives];
  const match = accepted.some((a) => normalizeAnswer(a, opts) === submitted);
  return match ? { correct: true, acceptedText: value.trim() } : { correct: false, acceptedText: null };
}
