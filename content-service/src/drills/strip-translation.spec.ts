import { stripLeadingTranslation } from './strip-translation';

describe('stripLeadingTranslation', () => {
  /**
   * Bank items for a Russian-taught English course carry the whole sentence twice: the
   * Russian translation first, then the English sentence with the blanks.
   *
   *   "Она может сделать эту работу без моей помощи. She can do this work [без]{without} my help."
   *
   * The student is learning English and already gets the hint inside each blank
   * (`[без]{without}`), so the leading translation is noise — it hands her the whole
   * sentence before she reads a word of English (reported 2026-08-10).
   */
  it('removes the Russian sentence and keeps the English one', () => {
    const input =
      'Она может сделать эту работу без моей помощи. ' +
      'She can do this work [без]{without} my help.';

    expect(stripLeadingTranslation(input)).toBe(
      'She can do this work [без]{without} my help.',
    );
  });

  it('keeps the prompts inside the blanks, which are the real hint', () => {
    const out = stripLeadingTranslation(
      'Вы не можете убежать от своего прошлого. You can\'t run away [от]{from} your past.',
    );

    expect(out).toContain('[от]{from}');
    expect(out).toBe("You can't run away [от]{from} your past.");
  });

  it('handles several Russian sentences before the English one', () => {
    const input =
      'Мы не можем пролететь над этим городом, мы полетим вокруг него. ' +
      "We can't fly [над]{over} this town, so we will fly [вокруг]{around} it.";

    expect(stripLeadingTranslation(input)).toBe(
      "We can't fly [над]{over} this town, so we will fly [вокруг]{around} it.",
    );
  });

  it('handles an ellipsis blank at the start of the English sentence', () => {
    const input = 'Самолёты этой авиакомпании очень старые. The planes […]{of}this airline are very old.';

    expect(stripLeadingTranslation(input)).toBe(
      'The planes […]{of}this airline are very old.',
    );
  });

  /**
   * The guard that matters: never return something with no blanks. A drill without a
   * blank is not a drill, and silently emptying one is worse than leaving the
   * translation in.
   */
  it('leaves the template alone when stripping would remove every blank', () => {
    // Blanks live in the Russian half — a Russian-language course, not an English one.
    const input = 'Я [иду]{иду} домой. I am going home.';

    expect(stripLeadingTranslation(input)).toBe(input);
  });

  it('leaves an English-only template untouched', () => {
    const clean = 'She can do this work [без]{without} my help.';
    expect(stripLeadingTranslation(clean)).toBe(clean);
  });

  it('leaves a template with no Cyrillic prefix untouched', () => {
    const clean = 'The planes […]{of} this airline are very old.';
    expect(stripLeadingTranslation(clean)).toBe(clean);
  });

  it('handles empty or missing input without throwing', () => {
    expect(stripLeadingTranslation('')).toBe('');
    expect(stripLeadingTranslation(null as unknown as string)).toBe('');
  });

  it('does not cut a sentence that merely contains a Cyrillic prompt', () => {
    // The Cyrillic here is INSIDE a blank, not a leading translation.
    const clean = 'This doctor receives [свыше]{over} fifty patients [по]{on} Mondays.';
    expect(stripLeadingTranslation(clean)).toBe(clean);
  });
});
