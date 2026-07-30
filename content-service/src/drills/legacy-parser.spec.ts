import { readFileSync } from 'fs';
import { join } from 'path';
import { parseLegacyExerciseFile, topicSlugFromClassName } from './legacy-parser';

const source = readFileSync(join(__dirname, '__fixtures__/grammar-sample.py'), 'utf8');

describe('parseLegacyExerciseFile', () => {
  it('finds every AnswerForm class', () => {
    const classes = parseLegacyExerciseFile(source, 'german.py');
    expect(classes.map((c) => c.className))
      .toEqual(['ComparisonAdjectivesEx1', 'DemonstrativePronounsEx1']);
  });

  it('finds all fields including the one wrapped across lines', () => {
    const [first] = parseLegacyExerciseFile(source, 'german.py');
    expect(first.items.map((i) => i.fieldName)).toEqual(['ex1', 'ex2', 'ex3']);
  });

  it('preserves the empty-prompt suffix drill', () => {
    const [first] = parseLegacyExerciseFile(source, 'german.py');
    expect(first.items[2].label).toContain('studier[]{e}');
  });

  it('unescapes a backslash-escaped apostrophe', () => {
    const classes = parseLegacyExerciseFile(source, 'dutch.py');
    expect(classes[1].items[0].label).toContain("{zo'}");
  });
});

describe('topicSlugFromClassName', () => {
  it('strips the trailing exercise number and kebab-cases', () => {
    expect(topicSlugFromClassName('ComparisonAdjectivesEx1')).toBe('comparison-adjectives');
    expect(topicSlugFromClassName('Lesson1Ex1')).toBe('lesson1');
  });
});
