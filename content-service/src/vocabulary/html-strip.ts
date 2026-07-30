/**
 * Strips HTML markup from SevenLesson.bodyHtml (and similar rich-text fields) before it
 * reaches tokenizeContentWords. That tokenizer is deliberately single-purpose and has no
 * HTML awareness — feeding it raw markup tokenizes tag and attribute names (span, br,
 * class, mute) straight into a student's vocabulary baseline. This is the fix, kept as its
 * own named helper (rather than an inline regex in the builder script) so it can be tested
 * in isolation.
 *
 * Handling, in order:
 *  1. Remove <script>/<style> elements INCLUDING their contents (a plain tag-strip would
 *     leave JS/CSS source text behind to be tokenized as "words").
 *  2. Remove HTML comments.
 *  3. Replace every remaining tag with a single space (not '') so two words separated only
 *     by an inline tag ("cat<b>dog</b>" or "Line1<br>Line2") don't glue into one token.
 *  4. Decode entities: numeric (decimal `&#65;` and hex `&#x0301;`) generically via
 *     String.fromCodePoint, plus a small table of common named entities. The hex form in
 *     particular matters for the real corpus: `&#x0301;` is a combining acute stress accent
 *     (U+0301) that appears attached to Cyrillic vowels — it must decode to an actual
 *     combining mark character (matched by the tokenizer's \p{M}) and NOT be swallowed as
 *     whitespace. An unrecognized named entity is left untouched rather than guessed at.
 *  5. Collapse whitespace runs (including the non-breaking space &nbsp; decodes to) to a
 *     single space and trim.
 */

const SCRIPT_OR_STYLE_ELEMENT_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const TAG_RE = /<[^>]+>/g;
const ENTITY_RE = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g;
const WHITESPACE_RUN_RE = /\s+/g;

// Common HTML entities seen in this corpus (Russian/French/German lesson prose). Anything
// not in this table is left as literal text rather than dropped or guessed at — see the
// "leaves an unrecognized named entity untouched" test.
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  mdash: '—',
  ndash: '–',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
};

function decodeEntity(match: string, body: string): string {
  if (body[0] === '#') {
    const isHex = body[1] === 'x' || body[1] === 'X';
    const codepoint = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    if (Number.isNaN(codepoint)) return match;
    try {
      return String.fromCodePoint(codepoint);
    } catch {
      // Invalid codepoint (e.g. out of Unicode range) — leave the original text alone.
      return match;
    }
  }
  return NAMED_ENTITIES[body.toLowerCase()] ?? match;
}

export function stripHtml(html: string): string {
  if (!html) return '';

  const withoutMarkup = html
    .replace(SCRIPT_OR_STYLE_ELEMENT_RE, ' ')
    .replace(COMMENT_RE, ' ')
    .replace(TAG_RE, ' ');

  const withEntitiesDecoded = withoutMarkup.replace(ENTITY_RE, decodeEntity);

  return withEntitiesDecoded.replace(WHITESPACE_RUN_RE, ' ').trim();
}
