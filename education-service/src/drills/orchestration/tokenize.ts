import { stopwordsFor } from './stopwords';

const WORD = /[\p{L}\p{M}'’-]+/gu;

export function tokenizeContentWords(text: string, languageCode: string): string[] {
  if (!text) return [];
  const stop = stopwordsFor(languageCode);
  const out: string[] = [];
  // Split on apostrophes only, so elision remnants (qu'est -> qu, est) are each filtered on
  // their own merits rather than gluing a stopword into an unfilterable token.
  //
  // Hyphens are deliberately NOT split. Splitting them shreds real single-lexeme compounds:
  // "week-end" became "week" + "end" (neither is a French word) and "rendez-vous" lost its
  // noun, so both registered as unknown vocabulary and corrupted the known-word ratio this
  // tokenizer exists to compute. Instead a hyphenated token is dropped only when EVERY part
  // is a stopword — "est-ce" and "as-tu" go, "week-end" and "rendez-vous" survive whole.
  // Note this is not "drop if ANY part is a stopword": that would also destroy "rendez-vous",
  // because "vous" is itself a stopword.
  for (const m of text.normalize('NFC').toLowerCase().split(/[’']/).join(' ').matchAll(WORD)) {
    const w = m[0].replace(/^['’-]+|['’-]+$/g, '');
    if (w.length === 0) continue;
    if (stop.has(w)) continue;
    if (w.includes('-')) {
      const parts = w.split('-').filter((p) => p.length > 0);
      if (parts.length > 0 && parts.every((p) => stop.has(p))) continue;
    }
    out.push(w);
  }
  return out;
}
