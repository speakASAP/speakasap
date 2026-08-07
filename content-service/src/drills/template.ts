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
