import { stripHtml } from './html-strip';

describe('stripHtml', () => {
  it('returns an empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('strips simple tags, keeping the text between them', () => {
    expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
  });

  it('removes attribute names along with the tag rather than leaking them as text — ' +
    'the exact failure named in the brief (span, br, class, mute tokenized as vocabulary)', () => {
    expect(stripHtml('<span class="mute">word</span>')).toBe('word');
  });

  it('replaces a tag with whitespace so adjacent words do not glue together', () => {
    expect(stripHtml('Line1<br>Line2')).toBe('Line1 Line2');
  });

  it('strips <script> tags AND their contents, not just the tags', () => {
    expect(stripHtml('<script>var x = 1; document.write("hax");</script>Hello')).toBe('Hello');
  });

  it('strips <style> tags AND their contents, not just the tags', () => {
    expect(stripHtml('<style>.mute { color: red; }</style>Hello')).toBe('Hello');
  });

  it('strips HTML comments entirely', () => {
    expect(stripHtml('<!-- a comment --> Hello')).toBe('Hello');
  });

  it('decodes &nbsp; to a whitespace separator', () => {
    expect(stripHtml('Hello&nbsp;World')).toBe('Hello World');
  });

  it('decodes &amp;', () => {
    expect(stripHtml('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });

  it('decodes the numeric hex combining stress accent (&#x0301;) seen in the real corpus', () => {
    const out = stripHtml('слов&#x0301;о');
    expect(out).toContain('́');
    expect(out).not.toContain('&#x0301;');
    // The combining mark must survive attached to its base letter, not be swallowed as
    // whitespace — it is \p{M}, not \p{Z}, so the tokenizer's WORD regex depends on this.
    expect(out).toBe('слов́о');
  });

  it('decodes decimal numeric entities', () => {
    expect(stripHtml('&#65;&#66;&#67;')).toBe('ABC');
  });

  it('leaves an unrecognized named entity untouched rather than guessing', () => {
    expect(stripHtml('&madeupentity;')).toBe('&madeupentity;');
  });

  it('collapses runs of whitespace left behind by tag removal', () => {
    expect(stripHtml('<div>\n  <p>A</p>\n  <p>B</p>\n</div>')).toBe('A B');
  });

  it('strips a dangling unclosed tag that runs to the end of the string, rather than ' +
    'leaking its name/attributes as text', () => {
    expect(stripHtml('Hello <span class="mute"')).toBe('Hello');
  });

  it('does not end a tag match early on a `>` inside a quoted attribute value', () => {
    expect(stripHtml('<a title="a > b">word</a>')).toBe('word');
  });

  it('handles a realistic SevenLesson.bodyHtml fragment end to end', () => {
    const html =
      '<p>Здравствуйте!&nbsp;Меня зовут <span class="mute">Анна</span>.<br>' +
      '<!-- teacher note -->Как дела?</p>';
    // Note: a tag replaced by whitespace immediately before punctuation leaves a stray
    // space-before-punctuation ("Анна ." not "Анна."). Harmless for this helper's purpose —
    // tokenizeContentWords only extracts letter/mark runs, so punctuation spacing is inert —
    // but documented here rather than silently asserted away.
    expect(stripHtml(html)).toBe('Здравствуйте! Меня зовут Анна . Как дела?');
  });
});
