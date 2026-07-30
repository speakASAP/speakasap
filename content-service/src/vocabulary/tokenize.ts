import { stopwordsFor } from './stopwords';

const WORD = /[\p{L}\p{M}'’-]+/gu;

export function tokenizeContentWords(text: string, languageCode: string): string[] {
  if (!text) return [];
  const stop = stopwordsFor(languageCode);
  const out: string[] = [];
  for (const m of text.normalize('NFC').toLowerCase().split(/[’']/).join(' ').matchAll(WORD)) {
    const w = m[0].replace(/^['’-]+|['’-]+$/g, '');
    if (w.length === 0) continue;
    if (stop.has(w)) continue;
    out.push(w);
  }
  return out;
}
