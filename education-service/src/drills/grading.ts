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
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]$/, '')
    .trim();
  if (!opts.caseSensitive) out = out.toLowerCase();
  return out;
}

export function gradeBlank(
  value: string,
  blank: DrillBlank,
  opts: GradingOptions,
): GradeResult {
  const submitted = normalizeAnswer(value, opts);
  if (submitted.length === 0) return { correct: false, acceptedText: null };

  const accepted = [blank.answer, ...blank.alternatives];
  const match = accepted.some((a) => normalizeAnswer(a, opts) === submitted);
  return match ? { correct: true, acceptedText: value.trim() } : { correct: false, acceptedText: null };
}
