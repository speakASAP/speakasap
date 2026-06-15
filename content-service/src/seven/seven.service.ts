import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../shared/prisma.service";

type JsonObject = Record<string, unknown>;

export type SevenCourseResponse = {
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
  metadata: JsonObject;
};

export type SevenMediaRef = {
  href: string;
  kind: "audio" | "video" | "pdf" | "image" | "media";
};

export type SevenExerciseResponse = {
  id: number;
  order: number;
  title: string;
  legacyKey: string;
  exerciseTemplate: string;
  answerTemplate: string | null;
  exerciseHtml: string;
  answerHtml: string | null;
  mediaRefs: SevenMediaRef[];
  metadata: JsonObject;
};

export type SevenLessonSummaryResponse = {
  id: number;
  legacyId: number;
  title: string;
  courseId: number;
  order: number;
  prefix: string | null;
  template: string;
  sitePath: string;
  appPath: string;
  pdfHref: string;
  mediaRefs: SevenMediaRef[];
  exercisesCount: number;
  metaKeywords: string | null;
  metaDescription: string | null;
  metadata: JsonObject;
};

export type SevenLessonDetailResponse = SevenLessonSummaryResponse & {
  bodyHtml: string;
  exercises: SevenExerciseResponse[];
  previousLesson: SevenLessonSummaryResponse | null;
  nextLesson: SevenLessonSummaryResponse | null;
};

const courseInclude = {
  language: true,
  _count: { select: { lessons: true } },
} satisfies Prisma.SevenCourseInclude;

const lessonSummaryInclude = {
  course: { include: { language: true } },
  _count: { select: { exercises: true } },
} satisfies Prisma.SevenLessonInclude;

const lessonDetailInclude = {
  course: { include: { language: true } },
  exercises: { orderBy: { order: "asc" as const } },
  _count: { select: { exercises: true } },
} satisfies Prisma.SevenLessonInclude;

@Injectable()
export class SevenService {
  private readonly logger = new Logger(SevenService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listCourses(languageCode?: string, materialLanguage?: string): Promise<SevenCourseResponse[]> {
    const normalizedLanguageCode = normalizeLegacyLanguageCode(languageCode);
    this.logger.debug(
      "Seven courses list: languageCode=" + (normalizedLanguageCode || "all") + " materialLanguage=" + (materialLanguage || "all"),
    );

    const courses = await this.prisma.sevenCourse.findMany({
      where: {
        ...(materialLanguage ? { materialLanguage } : {}),
        ...(normalizedLanguageCode ? { language: { code: normalizedLanguageCode } } : {}),
      },
      include: courseInclude,
      orderBy: [{ language: { order: "asc" } }, { id: "asc" }],
    });

    return courses.map(toCourseResponse);
  }

  async getCourse(languageCode: string, materialLanguage?: string): Promise<SevenCourseResponse | null> {
    const course = await this.findCourse(languageCode, materialLanguage, courseInclude);
    return course ? toCourseResponse(course) : null;
  }

  async listLessons(languageCode: string, materialLanguage?: string): Promise<SevenLessonSummaryResponse[] | null> {
    const course = await this.findCourse(languageCode, materialLanguage, { lessons: true });
    if (!course) {
      return null;
    }

    const lessons = await this.prisma.sevenLesson.findMany({
      where: { courseId: course.id },
      include: lessonSummaryInclude,
      orderBy: { order: "asc" },
    });

    return lessons.map(toLessonSummaryResponse);
  }

  async getLesson(
    languageCode: string,
    order: number,
    materialLanguage?: string,
  ): Promise<SevenLessonDetailResponse | null> {
    const normalizedLanguageCode = normalizeLegacyLanguageCode(languageCode);
    const lesson = await this.prisma.sevenLesson.findFirst({
      where: {
        order,
        course: {
          ...(materialLanguage ? { materialLanguage } : {}),
          language: { code: normalizedLanguageCode },
        },
      },
      include: lessonDetailInclude,
    });

    if (!lesson) {
      return null;
    }

    const [previousLesson, nextLesson] = await Promise.all([
      this.prisma.sevenLesson.findFirst({
        where: { courseId: lesson.courseId, order: { lt: lesson.order } },
        include: lessonSummaryInclude,
        orderBy: { order: "desc" },
      }),
      this.prisma.sevenLesson.findFirst({
        where: { courseId: lesson.courseId, order: { gt: lesson.order } },
        include: lessonSummaryInclude,
        orderBy: { order: "asc" },
      }),
    ]);

    return toLessonDetailResponse(lesson, previousLesson, nextLesson);
  }

  private async findCourse<TInclude extends Prisma.SevenCourseInclude>(
    languageCode: string | undefined,
    materialLanguage: string | undefined,
    include: TInclude,
  ): Promise<Prisma.SevenCourseGetPayload<{ include: TInclude }> | null> {
    const normalizedLanguageCode = normalizeLegacyLanguageCode(languageCode);
    if (!normalizedLanguageCode) {
      return null;
    }

    return this.prisma.sevenCourse.findFirst({
      where: {
        ...(materialLanguage ? { materialLanguage } : {}),
        language: { code: normalizedLanguageCode },
      },
      include,
      orderBy: { id: "asc" },
    });
  }
}

function normalizeLegacyLanguageCode(languageCode?: string): string | undefined {
  const normalized = languageCode?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return normalized === "po" ? "pl" : normalized;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function materialVersion(value: Date): string {
  return dateOnly(value).replace(/-/g, "");
}

function asObject(value: Prisma.JsonValue): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function lessonPrefix(prefix: string | null, order: number): string {
  return prefix || "Урок №" + order;
}

function publicAssetBaseUrl(): string {
  return (process.env.ASSETS_BASE_URL || "").replace(/\/$/, "");
}

function publicMediaHref(href: string): string {
  if (!href.startsWith("/media/")) {
    return href;
  }
  const base = publicAssetBaseUrl();
  return base ? base + href : href;
}

function rewriteHtmlMediaRefs(html: string | null): string | null {
  if (html === null) {
    return null;
  }
  return html.replace(/((?:src|href|data-src|data-src-ogg)=")\/media\/([^"#?\s>]+)((?:[?#][^"]*)?")/g, (_match, prefix: string, path: string, suffix: string) => {
    return prefix + publicMediaHref("/media/" + path) + suffix;
  }).replace(/((?:src|href|data-src|data-src-ogg)=')\/media\/([^'#?\s>]+)((?:[?#][^']*)?')/g, (_match, prefix: string, path: string, suffix: string) => {
    return prefix + publicMediaHref("/media/" + path) + suffix;
  });
}

function lessonPdfHref(languageCode: string, order: number): string {
  return publicMediaHref("/media/pdf/" + encodeURIComponent(languageCode) + "/lesson" + order + ".pdf");
}

function mediaKind(href: string): SevenMediaRef["kind"] {
  const lower = href.toLowerCase();
  if (lower.endsWith(".mp3") || lower.endsWith(".ogg") || lower.includes("/audio/")) return "audio";
  if (lower.includes("youtube.com") || lower.includes("youtu.be") || lower.endsWith(".mp4")) return "video";
  if (lower.endsWith(".pdf") || lower.includes("/pdf/")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return "image";
  return "media";
}

function mediaRefsFromMetadata(metadata: JsonObject, fallbackPdfHref?: string): SevenMediaRef[] {
  const refs = Array.isArray(metadata.mediaRefs) ? metadata.mediaRefs.filter((value): value is string => typeof value === "string") : [];
  const withFallback = fallbackPdfHref ? [...refs, fallbackPdfHref] : refs;
  return Array.from(new Set(withFallback)).map((href) => {
    const publicHref = publicMediaHref(href);
    return { href: publicHref, kind: mediaKind(publicHref) };
  });
}

function toCourseResponse(course: Prisma.SevenCourseGetPayload<{ include: typeof courseInclude }>): SevenCourseResponse {
  return {
    id: course.id,
    legacyId: course.legacyId,
    title: course.title,
    languageId: course.languageId,
    languageCode: course.language.code,
    languageName: course.language.name,
    materialLanguage: course.materialLanguage,
    metaKeywords: course.metaKeywords,
    metaDescription: course.metaDescription,
    appPackage: course.appPackage,
    materialsChanged: dateOnly(course.materialsChanged),
    version: materialVersion(course.materialsChanged),
    lessonsCount: course._count.lessons,
    metadata: asObject(course.metadata),
  };
}

function toLessonSummaryResponse(
  lesson: Prisma.SevenLessonGetPayload<{ include: typeof lessonSummaryInclude }>,
): SevenLessonSummaryResponse {
  const languageCode = lesson.course.language.code;
  const pdfHref = lessonPdfHref(languageCode, lesson.order);
  const metadata = asObject(lesson.metadata);
  return {
    id: lesson.id,
    legacyId: lesson.legacyId,
    title: lesson.title,
    courseId: lesson.courseId,
    order: lesson.order,
    prefix: lessonPrefix(lesson.prefix, lesson.order),
    template: lesson.template,
    sitePath: "/" + languageCode + "/seven/" + lesson.order + "/",
    appPath: "/seven/" + languageCode + "/app/lessons/" + lesson.order + "/",
    pdfHref,
    mediaRefs: mediaRefsFromMetadata(metadata, pdfHref),
    exercisesCount: lesson._count.exercises,
    metaKeywords: lesson.metaKeywords,
    metaDescription: lesson.metaDescription,
    metadata,
  };
}

function toLessonDetailResponse(
  lesson: Prisma.SevenLessonGetPayload<{ include: typeof lessonDetailInclude }>,
  previousLesson: Prisma.SevenLessonGetPayload<{ include: typeof lessonSummaryInclude }> | null,
  nextLesson: Prisma.SevenLessonGetPayload<{ include: typeof lessonSummaryInclude }> | null,
): SevenLessonDetailResponse {
  return {
    ...toLessonSummaryResponse(lesson),
    bodyHtml: rewriteHtmlMediaRefs(lesson.bodyHtml) ?? "",
    previousLesson: previousLesson ? toLessonSummaryResponse(previousLesson) : null,
    nextLesson: nextLesson ? toLessonSummaryResponse(nextLesson) : null,
    exercises: lesson.exercises.map((exercise) => {
      const metadata = asObject(exercise.metadata);
      const exerciseMeta = metadata.exercise && typeof metadata.exercise === "object" && !Array.isArray(metadata.exercise) ? metadata.exercise as JsonObject : {};
      const answerMeta = metadata.answer && typeof metadata.answer === "object" && !Array.isArray(metadata.answer) ? metadata.answer as JsonObject : {};
      return {
        id: exercise.id,
        order: exercise.order,
        title: exercise.title,
        legacyKey: exercise.legacyKey,
        exerciseTemplate: exercise.exerciseTemplate,
        answerTemplate: exercise.answerTemplate,
        exerciseHtml: rewriteHtmlMediaRefs(exercise.exerciseHtml) ?? "",
        answerHtml: rewriteHtmlMediaRefs(exercise.answerHtml),
        mediaRefs: [
          ...mediaRefsFromMetadata(exerciseMeta),
          ...mediaRefsFromMetadata(answerMeta),
        ],
        metadata,
      };
    }),
  };
}
