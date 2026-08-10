import { blankAnswersMatchTopic, TOPIC_WORD_SETS } from './topic-blanks';

describe('blankAnswersMatchTopic', () => {
  /**
   * The reported defect: a "prepositions" drill asked the student for `meeting`,
   * `girlfriend`, `flowers`, `big`, `house` — nouns and adjectives.
   *
   * Bank items are FILED under a topic, but each item blanks whatever its source blanked.
   * Of the 79 English items under `prepositions`, only 32 actually blank a preposition;
   * the picker chose from all 79. Filing is not the same as testing.
   */
  const item = (...answers: string[]) => ({
    blanks: answers.map((answer, index) => ({ index, answer, prompt: '', alternatives: [] })),
  });

  it('accepts an item whose blank IS a preposition', () => {
    expect(blankAnswersMatchTopic(item('about'), ['prepositions'], 'en')).toBe(true);
  });

  it('rejects an item that blanks a noun under the prepositions topic', () => {
    // "I will call you before and after the [совещания]{meeting}." — filed under
    // prepositions, but the student is asked for the noun.
    expect(blankAnswersMatchTopic(item('meeting'), ['prepositions'], 'en')).toBe(false);
  });

  it('rejects an item that blanks only adjectives and nouns', () => {
    expect(blankAnswersMatchTopic(item('big', 'house', 'my', 'children'), ['prepositions'], 'en'))
      .toBe(false);
  });

  it('accepts an item where at least one blank is a preposition', () => {
    // Mixed items still teach the preposition; requiring EVERY blank to be one would
    // reject most real sentences.
    expect(blankAnswersMatchTopic(item('house', 'through'), ['prepositions'], 'en')).toBe(true);
  });

  it('matches case-insensitively and ignores surrounding punctuation', () => {
    expect(blankAnswersMatchTopic(item('In'), ['prepositions'], 'en')).toBe(true);
    expect(blankAnswersMatchTopic(item(' at '), ['prepositions'], 'en')).toBe(true);
  });

  it('accepts a multi-word preposition', () => {
    expect(blankAnswersMatchTopic(item('in front of'), ['prepositions'], 'en')).toBe(true);
  });

  /**
   * The filter is OPT-IN by topic. A topic with no word list — most of them — must not be
   * filtered at all, or the change would silently empty every other drill.
   */
  it('accepts everything for a topic with no word list', () => {
    expect(blankAnswersMatchTopic(item('meeting'), ['future-simple'], 'en')).toBe(true);
    expect(blankAnswersMatchTopic(item('anything'), [], 'en')).toBe(true);
  });

  it('accepts everything for a language with no word list', () => {
    // German prepositions are a different set; absent a list, do not guess.
    expect(blankAnswersMatchTopic(item('meeting'), ['prepositions'], 'xx')).toBe(true);
  });

  it('accepts an item when ANY requested topic has no list', () => {
    // Mixed request: the teacher asked for prepositions AND something unlisted, so the
    // unlisted topic legitimately admits other answers.
    expect(blankAnswersMatchTopic(item('meeting'), ['prepositions', 'future-simple'], 'en'))
      .toBe(true);
  });

  it('treats an item with no blanks as not matching', () => {
    expect(blankAnswersMatchTopic({ blanks: [] }, ['prepositions'], 'en')).toBe(false);
  });

  it('carries a real English preposition list', () => {
    const list = TOPIC_WORD_SETS.en.prepositions;
    expect(list.has('about')).toBe(true);
    expect(list.has('through')).toBe(true);
    expect(list.has('meeting')).toBe(false);
  });
});
