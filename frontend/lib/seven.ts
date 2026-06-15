import { getGatewayBaseUrl } from './gateway';

export type SevenMediaRef = {
  href: string;
  kind: 'audio' | 'video' | 'pdf' | 'image' | 'media';
};

export type SevenCourse = {
  id: number;
  legacyId: number;
  title: string;
  languageId: number;
  languageCode: string;
  languageName: string;
  materialLanguage: string;
  metaKeywords: string | null;
  metaDescription: string | null;
  appPackage: string | null;
  materialsChanged: string;
  version: string;
  lessonsCount: number;
  metadata: Record<string, unknown>;
};

export type SevenLessonSummary = {
  id: number;
  legacyId: number;
  title: string;
  courseId: number;
  order: number;
  prefix: string;
  template: string;
  sitePath: string;
  appPath: string;
  pdfHref?: string;
  mediaRefs?: SevenMediaRef[];
  exercisesCount: number;
  metaKeywords: string | null;
  metaDescription: string | null;
  metadata: Record<string, unknown>;
};

export type SevenExercise = {
  id: number;
  order: number;
  title: string;
  legacyKey: string;
  exerciseTemplate: string;
  answerTemplate: string | null;
  exerciseHtml: string;
  answerHtml: string | null;
  mediaRefs?: SevenMediaRef[];
  metadata: Record<string, unknown>;
};

export type SevenLessonDetail = SevenLessonSummary & {
  bodyHtml: string;
  exercises: SevenExercise[];
  previousLesson?: SevenLessonSummary | null;
  nextLesson?: SevenLessonSummary | null;
};

export type SevenCoursePageData = {
  course: SevenCourse | null;
  lessons: SevenLessonSummary[];
  error: string | null;
};

export type SevenLessonPageData = SevenCoursePageData & {
  lesson: SevenLessonDetail | null;
};

const LANGUAGE_GENITIVE_BY_CODE: Record<string, string> = {
  en: 'английского',
  de: 'немецкого',
  fr: 'французского',
  es: 'испанского',
  it: 'итальянского',
  pt: 'португальского',
  pl: 'польского',
  po: 'польского',
  cz: 'чешского',
  cs: 'чешского',
  nl: 'голландского',
  sv: 'шведского',
  se: 'шведского',
  no: 'норвежского',
  da: 'датского',
  dk: 'датского',
  fi: 'финского',
  sk: 'словацкого',
  ru: 'русского',
  tr: 'турецкого',
  el: 'греческого',
  gr: 'греческого',
  cn: 'китайского',
  zh: 'китайского',
  jp: 'японского',
  ja: 'японского',
};

type Settled<T> = { ok: true; value: T } | { ok: false; error: string };

function stringFromMetadata(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export function getSevenPromoDescription(course: SevenCourse): string {
  const legacyGenitive = stringFromMetadata(course.metadata, 'legacyLanguageCaseGent');
  const languageGenitive = legacyGenitive ?? LANGUAGE_GENITIVE_BY_CODE[course.languageCode] ?? course.languageName;
  const level = course.languageCode === 'en' ? 'Pre-Intermediate' : 'A1';
  return `Этот курс ${languageGenitive} языка по нашей методике позволит дойти до уровня ${level} самостоятельно.`;
}

export function getSevenPdfHref(languageCode: string, order: number): string {
  return `/media/pdf/${encodeURIComponent(languageCode)}/lesson${order}.pdf`;
}

export function getSevenAppLinks(course: SevenCourse): { androidUrl: string | null; iosUrl: string | null } {
  return {
    androidUrl: stringFromMetadata(course.metadata, 'legacyAndroidUrl') ?? (course.appPackage ? `https://play.google.com/store/apps/details?id=${encodeURIComponent(course.appPackage)}&referrer=utm_source%3Dsite%26utm_content%3Dindex` : null),
    iosUrl: stringFromMetadata(course.metadata, 'legacyIosUrl'),
  };
}

const DEFAULT_SEVEN_DESCRIPTION = 'Иностранные языки. Елена Шипилова®. SpeakASAP®';

export function getSevenDescription(value: string | null | undefined): string {
  return value && value.trim() ? value : DEFAULT_SEVEN_DESCRIPTION;
}

async function gatewayJson<T>(path: string): Promise<T> {
  const baseUrl = getGatewayBaseUrl();
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is missing');
  }
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Gateway request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : 'Seven course data is not available' };
  }
}

function firstError(...results: Settled<unknown>[]): string | null {
  return results.find((result) => !result.ok)?.error ?? null;
}

export async function getSevenCoursePageData(languageCode: string): Promise<SevenCoursePageData> {
  const code = encodeURIComponent(languageCode);
  const [course, lessons] = await Promise.all([
    settle(gatewayJson<SevenCourse>(`/api/v1/seven/courses/${code}`)),
    settle(gatewayJson<SevenLessonSummary[]>(`/api/v1/seven/courses/${code}/lessons`)),
  ]);

  return {
    course: course.ok ? course.value : null,
    lessons: lessons.ok ? lessons.value : [],
    error: firstError(course, lessons),
  };
}

export async function getSevenLessonPageData(languageCode: string, order: string): Promise<SevenLessonPageData> {
  const code = encodeURIComponent(languageCode);
  const lessonOrder = encodeURIComponent(order);
  const [course, lessons, lesson] = await Promise.all([
    settle(gatewayJson<SevenCourse>(`/api/v1/seven/courses/${code}`)),
    settle(gatewayJson<SevenLessonSummary[]>(`/api/v1/seven/courses/${code}/lessons`)),
    settle(gatewayJson<SevenLessonDetail>(`/api/v1/seven/courses/${code}/lessons/${lessonOrder}`)),
  ]);

  return {
    course: course.ok ? course.value : null,
    lessons: lessons.ok ? lessons.value : [],
    lesson: lesson.ok ? lesson.value : null,
    error: firstError(lesson, course, lessons),
  };
}
