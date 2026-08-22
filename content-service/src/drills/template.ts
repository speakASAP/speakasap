import { createHash } from 'crypto';
import { DrillBlank, DrillTemplate, ParsedTemplate, DRILL_BLANK_PATTERN } from './contracts';

const HTML_TAG = /<[^>]+>/g;

/**
 * A fresh regex per call, because `g` patterns carry mutable `lastIndex` and sharing
 * one instance across `replace`/`matchAll` would make parsing depend on call order.
 *
 * Every flag on the shared constant is carried over, not just `g` — hard-coding the
 * flag list silently drops any other, so the parser would stop honouring the pattern
 * it is built from. `g` is unioned in because `matchAll` throws without it.
 */
const blankRe = () =>
  new RegExp(
    DRILL_BLANK_PATTERN.source,
    DRILL_BLANK_PATTERN.flags.includes('g')
      ? DRILL_BLANK_PATTERN.flags
      : `${DRILL_BLANK_PATTERN.flags}g`,
  );

export function parseTemplate(template: DrillTemplate): ParsedTemplate {
  const blanks: DrillBlank[] = [];
  let index = 0;
  const substituted = template.replace(blankRe(), (_m, prompt: string, answer: string) => {
    blanks.push({ index: index++, prompt, answer, alternatives: [] });
    return answer;
  });
  return { blanks, plainText: substituted.replace(HTML_TAG, '').trim() };
}

export function toSegments(
  template: DrillTemplate,
): ({ type: 'text'; value: string } | { type: 'blank'; index: number })[] {
  const segments: ({ type: 'text'; value: string } | { type: 'blank'; index: number })[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of template.matchAll(blankRe())) {
    const at = match.index!;
    if (at > cursor) segments.push({ type: 'text', value: template.slice(cursor, at) });
    segments.push({ type: 'blank', index: index++ });
    cursor = at + match[0].length;
  }
  if (cursor < template.length) segments.push({ type: 'text', value: template.slice(cursor) });
  return segments;
}

export function hashItem(plainText: string, languageCode: string): string {
  const normalized = plainText.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(`${languageCode}::${normalized}`).digest('hex');
}

/**
 * Trailing sentence punctuation — the part of a sentence a teacher retypes inconsistently.
 *
 * Deliberately anchored to the end. Punctuation inside a sentence changes what the
 * sentence says, so it stays part of the identity; a final `.`/`?`/`!` does not, and
 * closing quotes and brackets ride along with it.
 */
export const TRAILING_PUNCT = /[\s.,;:!?…"'”’»)\]]+$/u;

/**
 * A second lookup key for the bank, tolerant of a changed or missing final terminator.
 *
 * `hashItem` hashes the plain text verbatim. That made a sentence retyped without its
 * final period a different sentence: the lookup in `upsertItem` missed, a fresh row was
 * created, and the set ended up holding the same sentence twice. Production set
 * 3c9a3b78 collected three such pairs in eight minutes of editing on 2026-08-22, which
 * is the whole reason this exists.
 *
 * A separate keyspace, never a replacement — note the `loose::` tag. `hash` is @unique
 * and all 27,685 stored rows carry the strict value, so rebasing `hashItem` would have
 * to rewrite every one of them; worse, ignoring punctuation wholesale would collide
 * 5,884 rows that differ only in which words they blank, which are distinct exercises by
 * design (see `hashTemplateVariant`). So this is consulted as a fallback after the exact
 * hash misses, and what gets stored is still `hashItem`.
 */
export function hashItemLoose(plainText: string, languageCode: string): string {
  const normalized = plainText
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(TRAILING_PUNCT, '');
  return createHash('sha256').update(`${languageCode}::loose::${normalized}`).digest('hex');
}

/**
 * Whether two templates are the same drill.
 *
 * Same words blanked, same sentence — differing only in the final terminator, which a
 * teacher retyping a sentence in the review screen routinely drops or changes. Comparing
 * templates verbatim made `upsertItem` treat `...den Bus.` and `...den Bus` as two
 * exercises, so an edit that lost the period created a second bank row and the set
 * showed the sentence twice.
 *
 * Only the tail is ignored. Punctuation inside the sentence, and any difference in which
 * words are blanked, still make two distinct drills — that distinction is the whole
 * point of `hashTemplateVariant`.
 */
export function sameDrill(
  a: DrillTemplate | null | undefined,
  b: DrillTemplate | null | undefined,
): boolean {
  // A missing template is not equal to anything, including another missing one: the
  // callers use this to decide whether to reuse a bank row, and "both unknown" is not
  // grounds for reuse. The verbatim comparison this replaced was null-safe by accident,
  // and a legacy row can reach here without a template.
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const strip = (t: string): string =>
    t.normalize('NFC').replace(/\s+/g, ' ').trim().replace(TRAILING_PUNCT, '');
  return strip(a) === strip(b);
}

/**
 * Identity for a sentence that shares its plain text with a bank row but blanks different
 * words — two drills, not one, because which words a student must supply is the exercise.
 *
 * Separate from `hashItem` rather than replacing it: `hashItem` is what 14k+ imported rows
 * and the generation pipeline dedup on, and re-basing it on the template would change every
 * stored hash. This one is only reached when a template mismatch has already ruled reuse
 * out, so it never has to agree with the plain-text hash — only to be stable and distinct,
 * which the markup makes it.
 */
export function hashTemplateVariant(template: DrillTemplate, languageCode: string): string {
  const normalized = template.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(`${languageCode}::tpl::${normalized}`).digest('hex');
}
