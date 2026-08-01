/**
 * Topics where the answer must be drawn from a fixed set. The strongest possible
 * topic-alignment check, and it costs nothing — no model call, no ambiguity.
 *
 * A miss here is NOT fatal. The lists are deliberately incomplete (regional forms,
 * rarer prepositions, contracted articles like "zum"/"ins"), so an off-list answer
 * means "a human should look at this", never "discard it".
 */
export const CLOSED_LISTS: Record<string, Record<string, ReadonlySet<string>>> = {
  de: {
    prepositions: new Set([
      'an', 'auf', 'aus', 'bei', 'bis', 'durch', 'für', 'gegen', 'hinter', 'in',
      'mit', 'nach', 'neben', 'ohne', 'seit', 'über', 'um', 'unter', 'von', 'vor',
      'während', 'wegen', 'zu', 'zwischen',
    ]),
    articles: new Set([
      'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
      'einer', 'eines',
    ]),
  },
  en: {
    prepositions: new Set([
      'about', 'above', 'across', 'after', 'against', 'among', 'around', 'at', 'before',
      'behind', 'below', 'beside', 'between', 'by', 'down', 'during', 'for', 'from', 'in',
      'inside', 'into', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside', 'over',
      'since', 'through', 'to', 'toward', 'under', 'until', 'up', 'upon', 'with',
      'within', 'without',
    ]),
    articles: new Set(['a', 'an', 'the']),
  },
};

export function closedListFor(
  languageCode: string,
  topicSlug: string,
): ReadonlySet<string> | null {
  return CLOSED_LISTS[languageCode]?.[topicSlug] ?? null;
}
