import {
  VocabularyBaseline, VocabularyRatioResult,
  VOCABULARY_MIN_KNOWN_RATIO, VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE,
} from '../drills/contracts';
import { tokenizeContentWords } from './tokenize';

/**
 * The 80/20 vocabulary ratio checker. Decides whether a set of drill sentences is
 * acceptable for a student, given what they are known to already know.
 *
 * This is a pure, honest computation with no special case for `baseline.hasBaseline`.
 * When a course has no baseline at all, every word is unknown by construction, so
 * `knownRatio` comes back 0 and `passes` comes back `false` — that is the truthful
 * answer to "does this set meet the 80/20 rule against what we know this student
 * knows", given that we know nothing.
 *
 * A course with `baseline.hasBaseline === false` will therefore ALWAYS fail this
 * check. Deciding whether that is expected — e.g. a course that is known to have no
 * vocabulary tracking by design — versus a symptom of a failed or never-run
 * vocabulary build is a **caller** decision, not this function's. This function does
 * not have the course context to tell those two cases apart, and must not guess: a
 * caller that silently treats every `hasBaseline: false` failure as "skip the gate"
 * will also silently swallow a broken vocabulary build. Callers must distinguish an
 * intentionally-unsupported course (e.g. via a reviewed allowlist) from any other
 * `hasBaseline: false`, and surface the latter loudly rather than skipping it.
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
  const passes =
    knownRatio >= VOCABULARY_MIN_KNOWN_RATIO &&
    perItemUnknownCount.every((n) => n <= VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE);

  return { knownRatio, unknownWords, perItemUnknownCount, passes };
}
