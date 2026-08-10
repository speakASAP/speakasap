import { sanitizeTemplate } from './template-sanitize';

describe('sanitizeTemplate', () => {
  /**
   * The reported defect: the legacy grammar bank stores its glossary as a trailing
   * `<span class="mute">` inside the item label. The importer copied the label verbatim
   * into `template` AND extracted the same text into `hint`, so the review screen
   * rendered the markup as literal text and then repeated the glossary underneath it.
   *
   * 14,567 of 27,627 bank items were affected.
   */
  it('removes the trailing mute glossary, which is already carried in `hint`', () => {
    const input =
      'Я всегда думаю о своей семье. I always think [o]{about} my family. ' +
      '<span class="mute">(always – всегда; to think – думать; family – семья)</span>';

    // The leading Russian translation also goes — the student is learning English and
    // the blank carries its own prompt. See strip-translation.ts.
    expect(sanitizeTemplate(input)).toBe('I always think [o]{about} my family.');
  });

  it('keeps the blank syntax untouched', () => {
    // `[prompt]{answer}` is the drill format, not markup. Losing it destroys the item.
    const input = 'I will come [к]{to} your house <span class="mute">(house – дом)</span>';

    const out = sanitizeTemplate(input);

    expect(out).toContain('[к]{to}');
    expect(out).not.toContain('<span');
  });

  it('turns a line break into a space rather than gluing words together', () => {
    expect(sanitizeTemplate('Португальский:<br />Бразильский:')).toBe(
      'Португальский: Бразильский:',
    );
  });

  it('strips inline emphasis but keeps its text', () => {
    expect(sanitizeTemplate('<i>Португальский вариант:</i> O que [ты]{vais}?')).toBe(
      'Португальский вариант: O que [ты]{vais}?',
    );
  });

  /**
   * REFUSES rather than silently mangling. Two bank rows carry
   * `<input … answer="by" …>` — the answer lives in an attribute, so stripping the tag
   * deletes content a student is meant to fill in. Those rows need a real parser, not a
   * strip, and must be fixed deliberately rather than quietly emptied.
   */
  it('raises on an input tag, whose attribute holds the answer', () => {
    const input = 'Albert <input class="input-medium" answer="by" type="text" /> otvoril.';

    expect(() => sanitizeTemplate(input)).toThrow(/input/i);
  });

  it('leaves a clean template exactly as it is', () => {
    const clean = 'I always think [o]{about} my family.';
    expect(sanitizeTemplate(clean)).toBe(clean);
  });

  it('handles an empty or missing template without throwing', () => {
    expect(sanitizeTemplate('')).toBe('');
    expect(sanitizeTemplate(null as unknown as string)).toBe('');
  });

  it('decodes entities so a stray &nbsp; does not survive as text', () => {
    expect(sanitizeTemplate('a&nbsp;b')).toBe('a b');
  });
});
