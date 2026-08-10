import { parseTemplate } from './template';

/**
 * Removes the leading full translation from a bank item.
 *
 * Items for a Russian-taught English course carry the sentence twice — the Russian
 * translation, then the English sentence with the blanks:
 *
 *   "Она может сделать эту работу без моей помощи.
 *    She can do this work [без]{without} my help."
 *
 * The student is learning ENGLISH. Each blank already carries its own prompt
 * (`[без]{without}`), which is the hint she needs; the leading sentence hands her the
 * whole meaning before she reads a word of the target language, so it is noise.
 *
 * Scoped to the leading run of sentences before the first blank. A Cyrillic prompt
 * INSIDE a blank is untouched — that is the part the student is meant to translate.
 */

/** A sentence boundary followed by the start of the next sentence. */
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;
const CYRILLIC = /[Ѐ-ӿ]/;

export function stripLeadingTranslation(template: string): string {
  if (!template) {
    return '';
  }

  const firstBlank = template.search(/\[[^\]]*\]\{/);
  if (firstBlank === -1) {
    return template;
  }

  // Only the sentences that END before the first blank can be a leading translation.
  // Anything from the first blank onward is the drill itself.
  const head = template.slice(0, firstBlank);
  const sentences = head.split(SENTENCE_SPLIT);
  if (sentences.length < 2) {
    // The first blank is inside the first sentence, so there is no leading translation.
    return template;
  }

  // Drop leading whole sentences that are Cyrillic; stop at the first that is not, since
  // that one begins the English sentence carrying the blank.
  let dropped = 0;
  while (dropped < sentences.length - 1 && CYRILLIC.test(sentences[dropped])) {
    dropped += 1;
  }
  if (dropped === 0) {
    return template;
  }

  const keptHead = sentences.slice(dropped).join(' ');
  const candidate = (keptHead + template.slice(firstBlank)).trim();

  // Never return something with no blanks, and never return nothing. A drill without a
  // blank is not a drill; leaving the translation in is the lesser harm.
  if (!candidate) {
    return template;
  }
  const before = parseTemplate(template).blanks.length;
  const after = parseTemplate(candidate).blanks.length;
  if (after === 0 || after !== before) {
    return template;
  }

  return candidate;
}
