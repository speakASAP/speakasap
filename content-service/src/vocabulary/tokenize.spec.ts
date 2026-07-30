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
});
