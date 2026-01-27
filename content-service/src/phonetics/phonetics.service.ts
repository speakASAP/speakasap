import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { buildPaginatedResponse, getPaginationParams, PaginatedResponse } from '../shared/pagination';

export type PhoneticsLessonResponse = {
  id: number;
  title: string;
  courseId: number;
  order: number;
  metaKeywords: string | null;
  metaDescription: string | null;
};

export type PhoneticsCourseResponse = {
  id: number;
  title: string;
  languageId: number;
  materialLanguage: string;
  metaKeywords: string | null;
  metaDescription: string | null;
};

@Injectable()
export class PhoneticsService {
  private readonly logger = new Logger(PhoneticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listLessons(
    page?: string,
    limit?: string,
    filters?: {
      languageCode?: string;
      materialLanguage?: string;
      courseId?: number;
      order?: 'asc' | 'desc';
    },
  ): Promise<PaginatedResponse<PhoneticsLessonResponse>> {
    const { page: pageNumber, limit: limitNumber, skip } = getPaginationParams(page, limit);
    const orderBy = filters?.order === 'desc' ? 'desc' : 'asc';

    this.logger.debug(
      `Phonetics lessons list: page=${pageNumber} limit=${limitNumber} languageCode=${filters?.languageCode || 'all'}`,
    );

    const whereClause = {
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
      this.prisma.phoneticsLesson.count({ where: whereClause }),
      this.prisma.phoneticsLesson.findMany({
        where: whereClause,
        orderBy: { order: orderBy },
        skip,
        take: limitNumber,
      }),
    ]);

    this.logger.debug(`Phonetics lessons fetched: total=${total} returned=${lessons.length}`);

    return buildPaginatedResponse(
      lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        courseId: lesson.courseId,
        order: lesson.order,
        metaKeywords: lesson.metaKeywords,
        metaDescription: lesson.metaDescription,
      })),
      total,
      pageNumber,
      limitNumber,
    );
  }

  async getLessonById(lessonId: number): Promise<PhoneticsLessonResponse | null> {
    this.logger.debug(`Phonetics lesson detail: id=${lessonId}`);
    const lesson = await this.prisma.phoneticsLesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) {
      return null;
    }
    return {
      id: lesson.id,
      title: lesson.title,
      courseId: lesson.courseId,
      order: lesson.order,
      metaKeywords: lesson.metaKeywords,
      metaDescription: lesson.metaDescription,
    };
  }

  async listCourses(
    languageCode?: string,
    materialLanguage?: string,
  ): Promise<PhoneticsCourseResponse[]> {
    this.logger.debug(
      `Phonetics courses list: languageCode=${languageCode || 'all'} materialLanguage=${materialLanguage || 'all'}`,
    );

    const courses = await this.prisma.phoneticsCourse.findMany({
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
