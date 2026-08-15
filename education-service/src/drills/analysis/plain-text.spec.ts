import { toPlainText, toPlainTextAll } from './plain-text';

describe('toPlainText', () => {
  /**
   * The production regression: a German adjective-ending rule reached the student as
   * "Мужской род (der) + ein $\rightarrow$ окончание -er".
   */
  it('renders the LaTeX arrow that reached a student verbatim', () => {
    expect(toPlainText('Мужской род (der) + ein $\\rightarrow$ окончание -er')).toBe(
      'Мужской род (der) + ein → окончание -er',
    );
  });

  it('leaves ordinary text untouched', () => {
    const plain = 'Артикль должен соответствовать роду слова и падежу.';
    expect(toPlainText(plain)).toBe(plain);
  });

  it('unwraps inline and display math, keeping the contents', () => {
    expect(toPlainText('Endung $-er$ hier')).toBe('Endung -er hier');
    expect(toPlainText('$$a + b$$')).toBe('a + b');
    expect(toPlainText('\\(x\\) und \\[y\\]')).toBe('x und y');
  });

  it('converts the arrow commands a teacher actually reaches for', () => {
    expect(toPlainText('der $\\to$ dem')).toBe('der → dem');
    expect(toPlainText('$\\leftarrow$')).toBe('←');
    expect(toPlainText('$\\longrightarrow$')).toBe('→');
  });

  it('unwraps text-formatting commands rather than deleting their contents', () => {
    expect(toPlainText('\\textbf{wichtig} und \\text{normal}')).toBe('wichtig und normal');
  });

  it('strips Markdown emphasis and code fences', () => {
    expect(toPlainText('**Achtung**: `der` Hund')).toBe('Achtung: der Hund');
  });

  it('keeps the word when a command has no display form', () => {
    // Better a readable word than a stray control sequence on the student's page.
    expect(toPlainText('$\\alpha$ und $\\beta$')).toBe('alpha und beta');
  });

  it('unescapes LaTeX-escaped punctuation', () => {
    expect(toPlainText('50\\% richtig')).toBe('50% richtig');
  });

  it('handles empty and untouched values without throwing', () => {
    expect(toPlainText('')).toBe('');
    expect(toPlainTextAll([])).toEqual([]);
  });

  it('maps over a rules array', () => {
    expect(toPlainTextAll(['ein $\\to$ -er', 'eine $\\to$ -e'])).toEqual([
      'ein → -er',
      'eine → -e',
    ]);
  });
});
