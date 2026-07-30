import { lessonOrderFromClassName, courseKeyFor } from './seven-mapping';

describe('lessonOrderFromClassName', () => {
  it('reads the lesson number', () => {
    expect(lessonOrderFromClassName('Lesson1Ex1')).toBe(1);
    expect(lessonOrderFromClassName('Lesson12Ex3')).toBe(12);
  });

  it('returns null for a non-lesson class', () => {
    expect(lessonOrderFromClassName('ComparisonAdjectivesEx1')).toBeNull();
  });
});

describe('courseKeyFor', () => {
  it('joins language and material language', () => {
    expect(courseKeyFor('german', 'ru')).toBe('seven:german:ru');
  });
});
