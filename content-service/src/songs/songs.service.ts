import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { buildPaginatedResponse, getPaginationParams, PaginatedResponse } from '../shared/pagination';

export type SongsLessonResponse = {
  id: number;
  title: string;
  courseId: number;
  order: number;
};

export type SongsCourseResponse = {
  id: number;
  title: string;
  languageId: number;
  materialLanguage: string;
};

@Injectable()
export class SongsService {
  private readonly logger = new Logger(SongsService.name);

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
  ): Promise<PaginatedResponse<SongsLessonResponse>> {
    const { page: pageNumber, limit: limitNumber, skip } = getPaginationParams(page, limit);
    const orderBy = filters?.order === 'desc' ? 'desc' : 'asc';

    this.logger.debug(
      `Songs lessons list: page=${pageNumber} limit=${limitNumber} languageCode=${filters?.languageCode || 'all'}`,
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
      this.prisma.songsLesson.count({ where: whereClause }),
      this.prisma.songsLesson.findMany({
        where: whereClause,
        orderBy: { order: orderBy },
        skip,
        take: limitNumber,
      }),
    ]);

    this.logger.debug(`Songs lessons fetched: total=${total} returned=${lessons.length}`);

    return buildPaginatedResponse(
      lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        courseId: lesson.courseId,
        order: lesson.order,
      })),
      total,
      pageNumber,
      limitNumber,
    );
  }

  async getLessonById(lessonId: number): Promise<SongsLessonResponse | null> {
    this.logger.debug(`Songs lesson detail: id=${lessonId}`);
    const lesson = await this.prisma.songsLesson.findUnique({
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
    };
  }

  async listCourses(languageCode?: string, materialLanguage?: string): Promise<SongsCourseResponse[]> {
    this.logger.debug(
      `Songs courses list: languageCode=${languageCode || 'all'} materialLanguage=${materialLanguage || 'all'}`,
    );

    const courses = await this.prisma.songsCourse.findMany({
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
    }));
  }
}
