import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { buildPaginatedResponse, getPaginationParams, PaginatedResponse } from '../shared/pagination';

export type GrammarLessonResponse = {
  id: number;
  title: string;
  courseId: number;
  template: string;
  alias: string | null;
  url: string;
  section: string | null;
  teaser: string | null;
  order: number;
  metaKeywords: string | null;
  metaDescription: string | null;
};

export type GrammarCourseResponse = {
  id: number;
  title: string;
  languageId: number;
  materialLanguage: string;
  metaKeywords: string | null;
  metaDescription: string | null;
};

@Injectable()
export class GrammarService {
  private readonly logger = new Logger(GrammarService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listLessons(
    page?: string,
    limit?: string,
    filters?: {
      languageCode?: string;
      materialLanguage?: string;
      courseId?: number;
      section?: string;
      q?: string;
      order?: 'asc' | 'desc';
    },
  ): Promise<PaginatedResponse<GrammarLessonResponse>> {
    const { page: pageNumber, limit: limitNumber, skip } = getPaginationParams(page, limit);
    const orderBy = filters?.order === 'desc' ? 'desc' : 'asc';

    this.logger.debug(
      `Grammar lessons list: page=${pageNumber} limit=${limitNumber} languageCode=${filters?.languageCode || 'all'}`,
    );

    const whereClause = {
      ...(filters?.section ? { section: filters.section } : {}),
      ...(filters?.q ? { title: { contains: filters.q, mode: 'insensitive' as const } } : {}),
      ...(filters?.courseId || filters?.languageCode || filters?.materialLanguage
        ? {
            course: {
              ...(filters.courseId ? { id: filters.courseId } : {}),
              ...(filters.materialLanguage ? { materialLanguage: filters.materialLanguage } : {}),
              ...(filters.languageCode ? { language: { code: filters.languageCode } } : {}),
            },
          }
        : {}),
    };

    const [total, lessons] = await Promise.all([
      this.prisma.grammarLesson.count({ where: whereClause }),
      this.prisma.grammarLesson.findMany({
        where: whereClause,
        orderBy: { order: orderBy },
        skip,
        take: limitNumber,
      }),
    ]);

    this.logger.debug(`Grammar lessons fetched: total=${total} returned=${lessons.length}`);

    return buildPaginatedResponse(
      lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        courseId: lesson.courseId,
        template: lesson.template,
        alias: lesson.alias,
        url: lesson.url,
        section: lesson.section,
        teaser: lesson.teaser,
        order: lesson.order,
        metaKeywords: lesson.metaKeywords,
        metaDescription: lesson.metaDescription,
      })),
      total,
      pageNumber,
      limitNumber,
    );
  }

  async getLessonById(lessonId: number): Promise<GrammarLessonResponse | null> {
    this.logger.debug(`Grammar lesson detail: id=${lessonId}`);
    const lesson = await this.prisma.grammarLesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) {
      return null;
    }
    return {
      id: lesson.id,
      title: lesson.title,
      courseId: lesson.courseId,
      template: lesson.template,
      alias: lesson.alias,
      url: lesson.url,
      section: lesson.section,
      teaser: lesson.teaser,
      order: lesson.order,
      metaKeywords: lesson.metaKeywords,
      metaDescription: lesson.metaDescription,
    };
  }

  async listCourses(
    languageCode?: string,
    materialLanguage?: string,
  ): Promise<GrammarCourseResponse[]> {
    this.logger.debug(
      `Grammar courses list: languageCode=${languageCode || 'all'} materialLanguage=${materialLanguage || 'all'}`,
    );

    const courses = await this.prisma.grammarCourse.findMany({
      where: {
        ...(materialLanguage ? { materialLanguage } : {}),
        ...(languageCode ? { language: { code: languageCode } } : {}),
      },
      orderBy: { id: 'asc' },
    });

    return courses.map((course) => ({
      id: course.id,
      title: course.title,
      languageId: course.languageId,
      materialLanguage: course.materialLanguage,
      metaKeywords: course.metaKeywords,
      metaDescription: course.metaDescription,
    }));
  }
}
