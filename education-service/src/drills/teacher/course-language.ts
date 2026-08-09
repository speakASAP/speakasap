/**
 * The languages a lesson is taught in, derived from its `moduleClass`.
 *
 * `course_materials.data.<material>.<target>.…` — a course whose materials are written
 * in `<material>` teaching `<target>`. `…data.ru.en._basic_s.Module3T` is English taught
 * to Russian speakers. This is the portal's own convention; `cabinet/drills_client.py`
 * reads the same segment to pick the drilling panel's language.
 *
 * Exists because the teacher wizard hardcoded `('de', 'ru')` for both the topic picker
 * and generation, so an English course offered German topics (`adjektivgruppen`,
 * `nullartikel`) and would have generated German drills for an English student.
 */

/**
 * The language codes content-service actually holds, from `content.language.code`.
 *
 * Checked against this list rather than a generic two-letter test because the codes are
 * not all ISO 639-1 — `cz`, `se`, `dk`, `gr`, `jp`, `cn` are the platform's own. A
 * segment that merely looks like a code (`_demo`, `_mp3`) must not pass as one.
 */
const KNOWN_LANGUAGE_CODES = new Set([
  'cn', 'cz', 'de', 'dk', 'en', 'es', 'fi', 'fr', 'gr',
  'it', 'jp', 'nl', 'no', 'pl', 'pt', 'ru', 'se', 'sk', 'tr',
]);

export interface CourseLanguage {
  /** The language being learned — what drills are generated in. */
  languageCode: string;
  /** The language the materials and prompts are written in. */
  materialLanguage: string;
}

/**
 * Returns null when the module class names no language pair, rather than guessing.
 *
 * 11,716 production lessons carry `extra_lessons.ModuleExtraLessonsCourse`, which
 * encodes none. A guess would put the wrong language's grammar in front of a student,
 * which is exactly the defect this replaces — so "unknown" is surfaced to the caller
 * instead of being papered over with a default.
 */
export function courseLanguageOf(moduleClass: string | null | undefined): CourseLanguage | null {
  const value = (moduleClass ?? '').trim();
  if (!value.includes('.data.')) {
    return null;
  }

  const [material, target] = value.split('.data.')[1].split('.');
  if (!KNOWN_LANGUAGE_CODES.has(material) || !KNOWN_LANGUAGE_CODES.has(target)) {
    return null;
  }

  return { languageCode: target, materialLanguage: material };
}
