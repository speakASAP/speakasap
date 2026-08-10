/**
 * Does an item actually TEST the topic it is filed under?
 *
 * Bank items carry a topic, but each one blanks whatever its source blanked. A sentence
 * filed under `prepositions` may well blank the noun instead:
 *
 *   "I will call you before and after the [совещания]{meeting}."
 *
 * That is a vocabulary drill wearing a preposition label. Of the 79 English items filed
 * under `prepositions`, only 32 blank a preposition — and a student asked for a
 * "preposition drill" was given `meeting`, `girlfriend`, `flowers`, `big`, `house`
 * (reported 2026-08-10).
 *
 * Filing is not testing. Where we can say what a topic's answers should look like, this
 * checks it.
 *
 * OPT-IN by topic and language. A topic with no word list is not filtered at all —
 * anything else would silently empty every drill whose topic we have not enumerated.
 */

/** Words that a blank must be drawn from, per language and topic. */
export const TOPIC_WORD_SETS: Record<string, Record<string, Set<string>>> = {
  en: {
    prepositions: new Set([
      // Simple prepositions, the ones an A1-B2 course actually drills.
      'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'as',
      'at', 'before', 'behind', 'below', 'beneath', 'beside', 'besides', 'between',
      'beyond', 'by', 'despite', 'down', 'during', 'except', 'for', 'from', 'in',
      'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'opposite', 'out',
      'outside', 'over', 'past', 'per', 'round', 'since', 'than', 'through',
      'throughout', 'till', 'to', 'toward', 'towards', 'under', 'underneath', 'until',
      'up', 'upon', 'via', 'with', 'within', 'without',
      // Multi-word prepositions.
      'according to', 'ahead of', 'apart from', 'as for', 'because of', 'close to',
      'due to', 'except for', 'in front of', 'in spite of', 'instead of', 'next to',
      'on top of', 'out of', 'thanks to', 'up to',
    ]),
  },
};

interface BlankLike {
  answer?: string | null;
}

interface ItemLike {
  blanks?: BlankLike[] | null;
}

/** Lower-cased, trimmed, stripped of the punctuation that clings to a blank. */
function normalize(answer: string): string {
  return answer
    .toLowerCase()
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .replace(/\s+/g, ' ');
}

/**
 * True when the item is allowed through.
 *
 * ONE blank matching is enough. Requiring every blank to be a preposition would reject
 * most real sentences — "We will walk [через]{through} this [рынок]{market}" teaches the
 * preposition perfectly well.
 */
export function blankAnswersMatchTopic(
  item: ItemLike,
  topicSlugs: string[],
  languageCode: string,
): boolean {
  const byTopic = TOPIC_WORD_SETS[languageCode];
  if (!byTopic || topicSlugs.length === 0) {
    return true;
  }

  // If ANY requested topic has no list, the request legitimately admits other answers.
  const lists = topicSlugs.map((slug) => byTopic[slug]);
  if (lists.some((list) => !list)) {
    return true;
  }

  const blanks = item.blanks ?? [];
  if (blanks.length === 0) {
    return false;
  }

  return blanks.some((blank) => {
    const answer = normalize(blank?.answer ?? '');
    return answer.length > 0 && lists.some((list) => list!.has(answer));
  });
}
