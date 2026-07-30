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
 *  3. Replace every well-formed remaining tag with a single space (not '') so two words
 *     separated only by an inline tag ("cat<b>dog</b>" or "Line1<br>Line2") don't glue
 *     into one token. TAG_RE is quote-aware: a `>` inside a quoted attribute value (e.g.
 *     `<a title="a > b">`) does NOT end the match early — it's matched as part of the
 *     quoted-string alternative, not the bare "any non-angle-bracket char" alternative, so
 *     the tag's real closing `>` (after the quote) is the one that terminates it. Getting
 *     this wrong leaks a stray word from inside the attribute (here, "b") as if it were
 *     lesson prose.
 *  4. Strip a dangling UNCLOSED tag that runs to the end of the string (a `<` with no `>`
 *     anywhere after it) — step 3 requires a literal closing `>` and correctly leaves an
 *     unclosed tag untouched, so this is a deliberate second pass, not a gap in step 3.
 *     Real-world source: a `bodyHtml` value truncated mid-tag. Without this, a fragment
 *     like `Hello <span class="mute"` (no closing `>`) would leak "span class mute" as
 *     vocabulary — exactly the failure this whole helper exists to prevent.
 *  5. Decode entities: numeric (decimal `&#65;` and hex `&#x0301;`) generically via
 *     String.fromCodePoint, plus a small table of common named entities. The hex form in
 *     particular matters for the real corpus: `&#x0301;` is a combining acute stress accent
 *     (U+0301) that appears attached to Cyrillic vowels — it must decode to an actual
 *     combining mark character (matched by the tokenizer's \p{M}) and NOT be swallowed as
 *     whitespace. An unrecognized named entity is left untouched rather than guessed at.
 *  6. Collapse whitespace runs (including the non-breaking space &nbsp; decodes to) to a
 *     single space and trim.
 *
 * Known scope limit: this targets the two concrete gaps found in review (quoted `>` and a
 * tag unclosed to end-of-string). It does not attempt general malformed-HTML recovery —
 * e.g. a `<` missing a `>` for the same tag but with more valid markup and prose following
 * it later in the document is not the observed failure mode in this corpus and is not
 * handled.
 */

const SCRIPT_OR_STYLE_ELEMENT_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
// Quote-aware: after the tag name, repeat "any char that isn't < > " '" OR a whole
// quoted string (which may itself contain < or >), then require a literal closing >.
// This is what keeps a `>` inside a quoted attribute value from ending the match early.
const TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:[^<>"']|"[^"]*"|'[^']*')*\/?>/g;
// A `<` with no closing `>` anywhere for the rest of the string — a truncated/unclosed
// tag. Applied AFTER TAG_RE, which only ever matches well-formed (closed) tags.
const UNCLOSED_TAG_AT_END_RE = /<[^>]*$/;
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
    .replace(TAG_RE, ' ')
    .replace(UNCLOSED_TAG_AT_END_RE, ' ');

  const withEntitiesDecoded = withoutMarkup.replace(ENTITY_RE, decodeEntity);

  return withEntitiesDecoded.replace(WHITESPACE_RUN_RE, ' ').trim();
}
