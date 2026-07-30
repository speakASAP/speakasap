import { tokenizeContentWords } from './tokenize';

describe('tokenizeContentWords', () => {
  it('lowercases and NFC-normalizes', () => {
    expect(tokenizeContentWords('Schule HAUS', 'de')).toEqual(['schule', 'haus']);
  });

  it('drops German stopwords', () => {
    expect(tokenizeContentWords('Ich gehe in die Schule', 'de')).toEqual(['gehe', 'schule']);
  });

  it('drops punctuation but keeps diacritics', () => {
    expect(tokenizeContentWords('Café, s\'il vous plaît!', 'fr')).toEqual(['café', 'plaît']);
  });

  it('returns an empty array for empty input', () => {
    expect(tokenizeContentWords('', 'de')).toEqual([]);
  });

  it('falls back to no stopword filtering for an unknown language', () => {
    expect(tokenizeContentWords('foo bar', 'xx')).toEqual(['foo', 'bar']);
  });

  // Review finding 1: accented stopwords are unmatchable because the tokenizer preserves
  // diacritics but the original list only had the unaccented 'etait'.
  it('filters accented French stopwords (était)', () => {
    expect(tokenizeContentWords('Elle était là.', 'fr')).toEqual(['là']);
  });

  // Review finding 2: apostrophe-splitting manufactures stray single-letter tokens for
  // English contractions (don't -> don/t, John's -> john/s) unless the remnants are stopwords.
  it('drops English contraction remnants, not just the words they attach to', () => {
    const result = tokenizeContentWords("I don't know if John's dog is here.", 'en');
    expect(result).not.toContain('t');
    expect(result).not.toContain('s');
  });

  // Review finding 2/3: French elisions and hyphenated inversions manufacture stray
  // fragments (qu'est-ce -> qu/est/ce) and glue stopwords into unfilterable compounds
  // (est-ce as one token) unless hyphens are split like apostrophes.
  it('drops French elision remnants and unglues hyphenated stopword compounds', () => {
    const result = tokenizeContentWords("Qu'est-ce que c'est?", 'fr');
    expect(result).not.toContain('qu');
    expect(result).not.toContain('c');
    expect(result).not.toContain('est');
  });

  // Review finding 1: Spanish accented pronouns/adverbs (él, tú, también) are distinct
  // tokens from their unaccented counterparts (el, tu, tambien) already in the list.
  it('filters accented Spanish stopwords (él, tú, también)', () => {
    const result = tokenizeContentWords('¿Eres tú él también?', 'es');
    expect(result).not.toContain('tú');
    expect(result).not.toContain('él');
    expect(result).not.toContain('también');
  });
});
