import { courseLanguageOf } from './course-language';

describe('courseLanguageOf', () => {
  // `course_materials.data.<material>.<target>.…` — the portal's own convention, used by
  // cabinet/drills_client.py:panel_language for the same purpose.
  it('reads the target and material language from a module class', () => {
    expect(courseLanguageOf('course_materials.data.ru.en._basic_s.Module3T')).toEqual({
      languageCode: 'en',
      materialLanguage: 'ru',
    });
  });

  it('reads a German course as German, not as the hardcoded default', () => {
    // The bug this exists to prevent: every course was requested as 'de', so an English
    // course showed German topics and would have generated German drills.
    expect(courseLanguageOf('course_materials.data.ru.de._mp3.Module17')).toEqual({
      languageCode: 'de',
      materialLanguage: 'ru',
    });
  });

  it('handles a non-Russian material language', () => {
    expect(courseLanguageOf('course_materials.data.fr.ru._basic.Module1')).toEqual({
      languageCode: 'ru',
      materialLanguage: 'fr',
    });
  });

  // 11,787 production lessons carry `extra_lessons.ModuleExtraLessonsCourse`, which
  // encodes no language pair at all.
  it('returns null for a module class that names no language pair', () => {
    expect(courseLanguageOf('course_materials.data.extra_lessons.ModuleExtraLessonsCourse'))
      .toBeNull();
  });

  /**
   * Extra-lessons courses are sold from an offer whose product names the language, and
   * the resulting StudentCourse records it in `course_class` even though the lesson's own
   * `module_class` does not. All 11,787 such lessons in production resolve through the
   * course class and none through the module class, so the course wins.
   */
  it('prefers the course class, which names a language where the module class does not', () => {
    expect(
      courseLanguageOf(
        'course_materials.data.extra_lessons.ModuleExtraLessonsCourse',
        'course_materials.data.ru.it._extra.Course',
      ),
    ).toEqual({ languageCode: 'it', materialLanguage: 'ru' });
  });

  it('falls back to the module class when the course class names no pair', () => {
    expect(
      courseLanguageOf('course_materials.data.ru.en._basic_s.Module3T', 'nonsense'),
    ).toEqual({ languageCode: 'en', materialLanguage: 'ru' });
  });

  it('returns null when neither names a language pair', () => {
    expect(
      courseLanguageOf('course_materials.data.extra_lessons.ModuleExtraLessonsCourse', ''),
    ).toBeNull();
  });

  it('returns null rather than guessing for empty or unparseable input', () => {
    // Null means "unknown", which the caller surfaces. A guess would silently pick a
    // language and put the wrong grammar in front of a student.
    expect(courseLanguageOf('')).toBeNull();
    expect(courseLanguageOf('something.else.entirely')).toBeNull();
    expect(courseLanguageOf('course_materials.data.ru')).toBeNull();
  });

  it('rejects segments that are not two-letter language codes', () => {
    expect(courseLanguageOf('course_materials.data.ru._demo.Module1')).toBeNull();
  });
});
