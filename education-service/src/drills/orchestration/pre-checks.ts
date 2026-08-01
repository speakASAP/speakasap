import {
  DrillBlank,
  DrillTemplate,
  ValidationIssue,
  VocabularyBaseline,
} from '../contracts';
import { hashItem, parseTemplate } from '../template';
import { closedListFor } from './closed-lists';
import { checkVocabularyRatio } from './ratio';

export interface PreCheckItem {
  template: DrillTemplate;
  blanks: DrillBlank[];
  hint: string | null;
}

export interface PreCheckContext {
  languageCode: string;
  materialLanguage: string;
  topicSlugs: string[];
  /** Absent when the caller has no course context (a topic-only request). */
  baseline?: VocabularyBaseline;
  /** Hashes already in the bank or already chosen for this set. */
  existingHashes: Set<string>;
}

export interface PreCheckResult {
  itemRef: number;
  issues: ValidationIssue[];
  /** Discard, do not send to the validator. */
  fatal: boolean;
}

/** Codes that make an item structurally unusable rather than merely suspect. */
const FATAL_CODES = new Set([
  'MARKUP_UNPARSEABLE',
  'BLANK_COUNT_MISMATCH',
  'EMPTY_ANSWER',
  'WRONG_SCRIPT',
  'RESIDUAL_MARKUP',
  'DUPLICATE',
]);

/**
 * Per-language expected script. An answer whose letters are ENTIRELY in the wrong
 * script is WRONG_SCRIPT; mixed is allowed, because loanwords and proper nouns
 * legitimately carry foreign letters ("Café", "Мария" in a German sentence).
 */
const SCRIPTS: Record<string, RegExp> = {
  ru: /\p{Script=Cyrillic}/u,
  uk: /\p{Script=Cyrillic}/u,
  bg: /\p{Script=Cyrillic}/u,
  el: /\p{Script=Greek}/u,
};
const LATIN = /\p{Script=Latin}/u;
const LATIN_LANGUAGES = ['de', 'en', 'fr', 'es', 'it', 'nl', 'pt', 'sv', 'da', 'no', 'pl', 'cs', 'tr'];
for (const code of LATIN_LANGUAGES) {
  SCRIPTS[code] = LATIN;
}

const ANY_LETTER = /\p{L}/u;
/** Markup characters that must not survive parsing into the student-visible text. */
const RESIDUAL_MARKUP = /[[\]{}]/;

/**
 * Deterministic checks that run BEFORE the validator agent.
 *
 * Cheap, and they reject most bad model output for free. The fatal/non-fatal split
 * is the point: fatal means structurally unusable — discard silently and regenerate.
 * Non-fatal means "a human should look" — keep the item, show the teacher the issue.
 * Treating a non-fatal issue as fatal quietly throws away usable sentences and drives
 * needless regeneration; the reverse ships broken markup to a student.
 */
export function runPreChecks(items: PreCheckItem[], ctx: PreCheckContext): PreCheckResult[] {
  const results: PreCheckResult[] = [];
  // Seeded from the caller's hashes and extended as we go, so a batch that repeats
  // itself is caught too — the model collides with itself far more often than with
  // the bank.
  const seenHashes = new Set(ctx.existingHashes);
  const plainTexts: string[] = [];

  items.forEach((item, itemRef) => {
    const issues: ValidationIssue[] = [];
    const parsed = parseTemplate(item.template);
    plainTexts.push(parsed.plainText);

    if (parsed.blanks.length === 0) {
      issues.push({
        code: 'MARKUP_UNPARSEABLE',
        message: 'Template contains no parseable [prompt]{answer} blank',
      });
    }

    if (parsed.blanks.length !== item.blanks.length) {
      issues.push({
        code: 'BLANK_COUNT_MISMATCH',
        message: `Template has ${parsed.blanks.length} blank(s) but ${item.blanks.length} were declared`,
      });
    }

    for (const blank of item.blanks) {
      if (!blank.answer || blank.answer.trim() === '') {
        issues.push({
          code: 'EMPTY_ANSWER',
          message: `Blank ${blank.index} has an empty answer`,
        });
        continue;
      }
      const wrongScript = isWrongScript(blank.answer, ctx.languageCode);
      if (wrongScript) {
        issues.push({
          code: 'WRONG_SCRIPT',
          message: `Answer is entirely in the wrong script for ${ctx.languageCode}`,
          span: blank.answer,
        });
      }
      const offList = offClosedList(blank.answer, ctx);
      if (offList) {
        issues.push({
          code: 'CLOSED_LIST_MISMATCH',
          message: `Answer is not in the closed list for topic "${offList}"`,
          span: blank.answer,
        });
      }
    }

    // parseTemplate substitutes answers in and strips HTML, so anything bracket-like
    // still standing is markup the parser could not match — it would reach the student
    // verbatim.
    if (RESIDUAL_MARKUP.test(parsed.plainText)) {
      issues.push({
        code: 'RESIDUAL_MARKUP',
        message: 'Unparsed markup characters remain in the student-visible text',
        span: parsed.plainText,
      });
    }

    const hash = hashItem(parsed.plainText, ctx.languageCode);
    if (seenHashes.has(hash)) {
      issues.push({ code: 'DUPLICATE', message: 'Item duplicates one already selected or in the bank' });
    } else {
      seenHashes.add(hash);
    }

    results.push({ itemRef, issues, fatal: issues.some((i) => FATAL_CODES.has(i.code)) });
  });

  applyVocabularyGate(results, plainTexts, ctx);
  return results;
}

/**
 * The 80/20 rule, scored across the batch but reported per item.
 *
 * Skipped entirely when the course has no baseline: every word would be unknown by
 * construction and every item flagged. content-service's ratio.ts states that telling
 * an intentionally-unsupported course apart from a failed vocabulary build is a CALLER
 * decision — this is that decision, made explicitly. `hasBaseline: false` is a signal
 * about the course, not a verdict on these sentences.
 */
function applyVocabularyGate(
  results: PreCheckResult[],
  plainTexts: string[],
  ctx: PreCheckContext,
): void {
  if (!ctx.baseline || !ctx.baseline.hasBaseline) {
    return;
  }

  const ratio = checkVocabularyRatio(plainTexts, ctx.baseline);
  if (ratio.passes) {
    return;
  }

  results.forEach((result, i) => {
    const unknownHere = ratio.perItemUnknownCount[i] ?? 0;
    if (unknownHere === 0) {
      return;
    }
    result.issues.push({
      code: 'VOCABULARY_RATIO',
      message: `${unknownHere} word(s) outside the student's vocabulary (batch known ratio ${ratio.knownRatio.toFixed(2)})`,
    });
    // Deliberately does not touch `fatal`: unfamiliar vocabulary is a judgement call
    // for the teacher, not a structural defect.
  });
}

function isWrongScript(answer: string, languageCode: string): boolean {
  const expected = SCRIPTS[languageCode];
  if (!expected) {
    return false;
  }
  const letters = [...answer].filter((ch) => ANY_LETTER.test(ch));
  if (letters.length === 0) {
    return false;
  }
  return letters.every((ch) => !expected.test(ch));
}

/** Returns the topic slug whose closed list the answer violates, or null. */
function offClosedList(answer: string, ctx: PreCheckContext): string | null {
  const normalized = answer.normalize('NFC').toLowerCase().trim();
  for (const slug of ctx.topicSlugs) {
    const list = closedListFor(ctx.languageCode, slug);
    if (list && !list.has(normalized)) {
      return slug;
    }
  }
  return null;
}
