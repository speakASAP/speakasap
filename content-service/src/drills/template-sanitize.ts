import { stripHtml } from '../vocabulary/html-strip';
import { stripLeadingTranslation } from './strip-translation';

/**
 * Cleans presentation markup out of a drill item's `template`.
 *
 * The legacy grammar and seven banks store each item as a rich-text label: the sentence,
 * then a trailing glossary in `<span class="mute">…</span>`, sometimes with `<br>`, `<b>`
 * or `<i>` inside. `import-grammar-bank.ts` copied that label verbatim into `template`
 * while ALSO extracting the same glossary into `hint`.
 *
 * Nothing renders `template` as HTML — correctly, since a bank is not a trusted source of
 * markup — so the review screen showed the raw tag as literal text and then repeated the
 * glossary underneath it. 14,567 of 27,627 bank items were affected.
 *
 * `[prompt]{answer}` is drill syntax, not markup, and passes through untouched.
 */

/**
 * `<input>` carries the answer in an attribute (`answer="by"`), so stripping the tag
 * deletes the very thing the student must supply. Two production rows are shaped this
 * way. They need a real parser that turns the attribute into a `[…]{…}` blank; until then
 * this raises rather than quietly emptying them.
 */
const INPUT_TAG_RE = /<input\b/i;

/**
 * The mute glossary is removed WITH its contents, not just its tags.
 *
 * `stripHtml` alone would drop `<span>` and leave `(always – всегда; …)` inline, which is
 * the same duplication in plainer clothing: that text is already the item's `hint` and is
 * rendered separately beneath the sentence. Every one of the 14,567 affected rows has a
 * non-empty `hint`, verified in production before this was written.
 */
const MUTE_ELEMENT_RE = /<span\s+class=["']mute["']\s*>[\s\S]*?<\/span>/gi;

export function sanitizeTemplate(template: string): string {
  if (!template) {
    return '';
  }

  if (INPUT_TAG_RE.test(template)) {
    throw new Error(
      'sanitizeTemplate: template contains an <input> tag whose attributes hold the ' +
        'answer; stripping it would delete content. Convert it to [prompt]{answer} first.',
    );
  }

  // Also drops the leading full translation: a Russian-taught English item carries the
  // sentence twice, and the student is learning English. See strip-translation.ts.
  return stripLeadingTranslation(stripHtml(template.replace(MUTE_ELEMENT_RE, ' ')));
}

/** True when the template carries markup that `sanitizeTemplate` would remove. */
export function hasMarkup(template: string): boolean {
  return Boolean(template) && /<[a-zA-Z/!]/.test(template);
}
