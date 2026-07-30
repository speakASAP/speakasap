import { createHash } from 'crypto';
import { DrillBlank, DrillTemplate, ParsedTemplate } from './contracts';

const BLANK = /\[([^\]]*)\]\{([^}]*)\}/g;
const HTML_TAG = /<[^>]+>/g;

export function parseTemplate(template: DrillTemplate): ParsedTemplate {
  const blanks: DrillBlank[] = [];
  let index = 0;
  const substituted = template.replace(BLANK, (_m, prompt: string, answer: string) => {
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
  for (const match of template.matchAll(BLANK)) {
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
