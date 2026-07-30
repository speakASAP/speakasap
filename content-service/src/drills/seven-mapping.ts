/**
 * Mapping helpers for the course-material ("seven") exercise bank.
 *
 * Unlike the grammar bank, seven exercise classes are named `Lesson<N>Ex<M>`
 * and map directly onto a real, populated `SevenLesson.order` — this is what
 * lets Task A.6 build a vocabulary baseline per lesson. Classes that don't
 * match this shape can't be placed in a lesson and must be skipped by the
 * importer (counted as `itemsSkippedNoLesson`).
 */

const LESSON_CLASS_RE = /^Lesson(\d+)Ex\d+$/;

export function lessonOrderFromClassName(className: string): number | null {
  const m = className.match(LESSON_CLASS_RE);
  return m ? Number(m[1]) : null;
}

export function courseKeyFor(languageMachineName: string, materialLanguage: string): string {
  return `seven:${languageMachineName}:${materialLanguage}`;
}
