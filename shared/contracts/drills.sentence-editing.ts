/**
 * Drill sentence editing — SINGLE SOURCE OF TRUTH.
 *
 * The source is speakasap/shared/contracts/drills.sentence-editing.ts. This header is
 * copied verbatim into every vendored file, so if you are reading it anywhere else —
 * including frontend/lib/drills/sentence-editing.ts — you are in a generated copy and
 * your edit will be overwritten by the next sync.
 *
 * Do not edit the vendored copies in services. Edit this file, then run
 *   speakasap/shared/scripts/sync-drill-contracts.sh
 */

import {
  DRILL_BLANK_PATTERN,
  type DrillBlank,
  type DrillTemplate,
  type ValidationIssue,
} from './contracts';

/**
 * Turning a sentence into a drill, and back.
 *
 * A teacher types or pastes plain text and clicks the words a student must supply. That
 * interaction needs the sentence as a list of clickable words; storage needs the
 * `[prompt]{answer}` template. These functions are the two directions of that mapping,
 * plus the rules a sentence must satisfy before it can be saved.
 *
 * Pure and dependency-free on purpose: the same rules run in the browser for immediate
 * feedback and on both services as the authority. Server-side validation is never
 * skipped because the client already checked — the client is not trustworthy.
 */

/** One word of a sentence as the editor manipulates it. */
export interface EditableWord {
  /** The word as it appears in the target language. Becomes the answer when marked. */
  text: string;
  /** Whether the student must supply this word. */
  isBlank: boolean;
  /**
   * The native-language hint shown in place of the word. Legally empty — the bank
   * contains suffix drills of the form `Ich heiß[]{e}` where the bracket carries no text.
   */
  prompt: string;
  /**
   * Punctuation that followed this word with no space before it, e.g. the `;` in
   * `[дома]{home};`. Carried on the word rather than tokenized separately so a round trip
   * through the editor is lossless: splitting on whitespace alone re-joined it as
   * `home] ;`, silently inserting a space before the punctuation of every sentence a
   * teacher edited. Production assignment a1748629 contains exactly this shape.
   */
  suffix?: string;
}

/**
 * A fresh regex per call. `g` patterns carry mutable `lastIndex`, so a shared instance
 * would make results depend on call order — the same reasoning as
 * `content-service/src/drills/template.ts`.
 */
const blankRe = (): RegExp =>
  new RegExp(
    DRILL_BLANK_PATTERN.source,
    DRILL_BLANK_PATTERN.flags.includes('g')
      ? DRILL_BLANK_PATTERN.flags
      : `${DRILL_BLANK_PATTERN.flags}g`,
  );

/** Markup characters that must not survive parsing as literal text. */
const MARKUP_CHARS = /[[\]{}]/;

export function buildTemplate(words: EditableWord[]): DrillTemplate {
  return words
    .map(
      (word) =>
        (word.isBlank ? `[${word.prompt}]{${word.text}}` : word.text) + (word.suffix ?? ''),
    )
    .join(' ');
}

/**
 * Splits a template into editable words.
 *
 * A blank stays one word even when its answer contains spaces: `[из]{out of}` is a single
 * thing the student supplies. Splitting it on whitespace would ask them to fill a
 * fragment, so blanks are lifted out before the plain text between them is tokenized.
 */
export function parseToWords(template: DrillTemplate): EditableWord[] {
  const words: EditableWord[] = [];
  let cursor = 0;

  const pushPlain = (text: string): void => {
    for (const token of text.split(/\s+/)) {
      if (token !== '') {
        words.push({ text: token, isBlank: false, prompt: '' });
      }
    }
  };

  for (const match of template.matchAll(blankRe())) {
    const at = match.index ?? 0;
    if (at > cursor) {
      pushPlain(template.slice(cursor, at));
    }
    cursor = at + match[0].length;

    // Punctuation pressed against the closing brace belongs to this blank, not to the
    // next word. Emitting it as its own token re-joined it with a space in front.
    const trailing = /^[^\s\w[\]{}]+/.exec(template.slice(cursor));
    const suffix = trailing ? trailing[0] : '';
    cursor += suffix.length;

    words.push({ text: match[2], isBlank: true, prompt: match[1], suffix });
  }

  if (cursor < template.length) {
    pushPlain(template.slice(cursor));
  }

  return words;
}

/** The blanks a template defines, in order of appearance. */
export function blanksFor(template: DrillTemplate): DrillBlank[] {
  const blanks: DrillBlank[] = [];
  let index = 0;
  for (const match of template.matchAll(blankRe())) {
    blanks.push({ index: index++, prompt: match[1], answer: match[2], alternatives: [] });
  }
  return blanks;
}

/**
 * Why a sentence cannot be saved, or an empty array when it can.
 *
 * Every rule is checked and every failure reported, rather than returning at the first
 * problem: a teacher discovering errors one save at a time is the experience this avoids.
 *
 * Codes are reused from the existing `ValidationIssueCode` union so the review screen
 * renders these exactly as it renders the generator's own findings.
 */
export function validateSentence(template: DrillTemplate): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const blanks = blanksFor(template);

  if (blanks.length === 0) {
    issues.push({
      code: 'BLANK_COUNT_MISMATCH',
      message: 'Mark at least one word for the student to fill in.',
    });
  }

  for (const blank of blanks) {
    if (blank.answer.trim() === '') {
      issues.push({
        code: 'EMPTY_ANSWER',
        message: 'Every blank needs the correct answer the student is expected to type.',
        span: `[${blank.prompt}]{${blank.answer}}`,
      });
    }
  }

  // What is left once the blanks are removed: the words the student reads. Checked for
  // stray markup, which would otherwise reach them verbatim, and for being non-empty,
  // since a sentence that is only a blank gives nothing to reason from.
  const outsideBlanks = template.replace(blankRe(), ' ');

  if (MARKUP_CHARS.test(outsideBlanks)) {
    issues.push({
      code: 'RESIDUAL_MARKUP',
      message: 'Remove the stray [ ] { } characters — only marked words may use them.',
    });
  }

  if (outsideBlanks.trim() === '') {
    issues.push({
      code: 'MARKUP_UNPARSEABLE',
      message: 'A sentence needs words around the blanks, not only the blanks themselves.',
    });
  }

  return issues;
}

/**
 * Splits pasted prose into individual sentences.
 *
 * Newlines win over punctuation: a teacher pasting a numbered list has one sentence per
 * line regardless of whether the lines end in a full stop. Within a line, terminal
 * punctuation ends a sentence.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/\r?\n/)
    .flatMap((line) => line.match(/[^.!?…]+[.!?…]*/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '');
}
