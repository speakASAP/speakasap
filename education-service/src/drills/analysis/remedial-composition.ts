import { PersistedFailedAnswer } from './contracts';

/**
 * The floor on assignment length.
 *
 * A three-sentence drill is not an assignment; it is a flashcard. Below this the gap is
 * padded with NEW sentences on the same grammar topic (different vocabulary), which tests
 * the rule the student broke rather than their memory of three specific words.
 */
export const MIN_REMEDIAL_SENTENCES = 10;

/**
 * The ceiling.
 *
 * Twenty sentences is roughly ten to fifteen minutes. Beyond that the drill stops being
 * something a student finishes in one sitting, so the gap splits into parts instead.
 */
export const MAX_REMEDIAL_SENTENCES = 20;

export interface RemedialPart {
  /** 1-based. */
  part: number;
  totalParts: number;
  /** Required occurrences plus padding. */
  sentenceCount: number;
  requiredAnswers: Array<{ answer: string; normalized: string; occurrences: number }>;
  /** Sentences on the same topic with different vocabulary. */
  paddingCount: number;
}

/**
 * Plans the remedial drill for one grammar gap.
 *
 * The rules, all decided here:
 *
 * - **`occurrences = mistakeCount`**, strictly. A word missed once earns one sentence; a
 *   word missed six times earns six. No floor and no cap: the floor would inflate a small
 *   gap into busywork, and the cap would under-drill the word the student most needs.
 * - **100% error words.** Nothing the student answered correctly is included.
 * - **Mastered words are excluded** — three consecutive first-try-clean appearances retire
 *   a word, and drilling it again spends attention on something already learned.
 * - **Padding only to reach the minimum**, never above it, and never by repeating an error
 *   word beyond its mistake count.
 * - **Splitting spreads answers**, so each part exercises the whole gap rather than one
 *   part being nothing but the worst word.
 */
export function composeRemedial(
  answers: PersistedFailedAnswer[],
  masteredNormalized: Set<string>,
): RemedialPart[] {
  const eligible = answers.filter(
    (a) => a.mistakeCount > 0 && !masteredNormalized.has(a.normalized),
  );

  if (eligible.length === 0) {
    return [];
  }

  // One slot per mistake, interleaved by answer so that any contiguous run of slots
  // touches as many different answers as possible. Splitting then falls out of slicing
  // this list, with no separate balancing pass.
  const slots = interleave(eligible);
  const totalParts = Math.max(1, Math.ceil(slots.length / MAX_REMEDIAL_SENTENCES));
  const perPart = Math.ceil(slots.length / totalParts);

  const parts: RemedialPart[] = [];

  for (let index = 0; index < totalParts; index++) {
    const slice = slots.slice(index * perPart, (index + 1) * perPart);
    if (slice.length === 0) {
      continue;
    }

    const counts = new Map<string, { answer: string; normalized: string; occurrences: number }>();
    for (const slot of slice) {
      const existing = counts.get(slot.normalized);
      if (existing) {
        existing.occurrences += 1;
      } else {
        counts.set(slot.normalized, {
          answer: slot.answer,
          normalized: slot.normalized,
          occurrences: 1,
        });
      }
    }

    const required = slice.length;
    const sentenceCount = Math.max(MIN_REMEDIAL_SENTENCES, required);

    parts.push({
      part: parts.length + 1,
      totalParts,
      sentenceCount,
      requiredAnswers: [...counts.values()],
      paddingCount: sentenceCount - required,
    });
  }

  // `totalParts` was computed before empty slices were dropped. Restate it so a part never
  // claims to be one of three when two exist.
  return parts.map((part) => ({ ...part, totalParts: parts.length }));
}

/**
 * One slot per mistake, round-robin across answers.
 *
 * `[a×3, b×1]` becomes `a, b, a, a` rather than `a, a, a, b`, so a split at any point
 * leaves both answers represented on both sides.
 */
function interleave(
  answers: PersistedFailedAnswer[],
): Array<{ answer: string; normalized: string }> {
  const remaining = answers.map((a) => ({
    answer: a.answer,
    normalized: a.normalized,
    left: a.mistakeCount,
  }));
  const slots: Array<{ answer: string; normalized: string }> = [];

  let anyLeft = true;
  while (anyLeft) {
    anyLeft = false;
    for (const entry of remaining) {
      if (entry.left > 0) {
        slots.push({ answer: entry.answer, normalized: entry.normalized });
        entry.left -= 1;
        anyLeft = anyLeft || entry.left > 0;
      }
    }
  }

  return slots;
}
