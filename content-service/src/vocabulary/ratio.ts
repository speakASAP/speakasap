import {
  VocabularyBaseline, VocabularyRatioResult,
  VOCABULARY_MIN_KNOWN_RATIO, VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE,
} from '../drills/contracts';
import { tokenizeContentWords } from './tokenize';

/**
 * The 80/20 vocabulary ratio checker. Decides whether a set of drill sentences is
 * acceptable for a student, given what they are known to already know.
 *
 * When `baseline.hasBaseline` is false (no vocabulary has ever been built for this
 * course — true today for chinese/english/japanese), there is nothing to fail
 * sentences against: every word would register as "unknown" and a naive ratio would
 * always reject, sending sets into an unbreakable regeneration loop. The real numbers
 * are still computed and returned for diagnostics, but `passes` is forced true and
 * `assessed` is set to false so callers can tell "failed the ratio" apart from
 * "could not be assessed" instead of misreading a forced pass as a real one.
 */
export function checkVocabularyRatio(
  plainTexts: string[],
  baseline: VocabularyBaseline,
): VocabularyRatioResult {
  const known = new Set(baseline.index);
  const unknownWords: string[] = [];
  const seenUnknown = new Set<string>();
  const perItemUnknownCount: number[] = [];
  let total = 0;
  let knownCount = 0;

  for (const text of plainTexts) {
    const tokens = tokenizeContentWords(text, baseline.languageCode);
    let itemUnknown = 0;
    for (const t of tokens) {
      total++;
      if (known.has(t)) {
        knownCount++;
      } else {
        itemUnknown++;
        if (!seenUnknown.has(t)) { seenUnknown.add(t); unknownWords.push(t); }
      }
    }
    perItemUnknownCount.push(itemUnknown);
  }

  const knownRatio = total === 0 ? 1 : knownCount / total;
  const ratioPasses =
    knownRatio >= VOCABULARY_MIN_KNOWN_RATIO &&
    perItemUnknownCount.every((n) => n <= VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE);

  return {
    knownRatio,
    unknownWords,
    perItemUnknownCount,
    passes: baseline.hasBaseline ? ratioPasses : true,
    assessed: baseline.hasBaseline,
  };
}
