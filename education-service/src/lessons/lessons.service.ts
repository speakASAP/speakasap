import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse, getPaginationParams } from '../shared/pagination';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByStudentCourse(studentCourseUuid: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const where = { studentCourseUuid };
    const [items, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        orderBy: { order: 'asc' },
        skip,
        take: l,
      }),
      this.prisma.lesson.count({ where }),
    ]);
    const mapped = items.map((lesson) => ({
      uuid: lesson.uuid,
      order: lesson.order,
      teacherId: lesson.teacherId,
      start: lesson.start?.toISOString() ?? null,
      isFinished: lesson.isFinished,
      studentCourseUuid: lesson.studentCourseUuid,
      moduleClass: lesson.moduleClass,
      needsTeacher: lesson.needsTeacher,
    }));
    return buildPaginatedResponse(mapped, total, p, l);
  }

  async getByUuid(uuid: string) {
    const row = await this.prisma.lesson.findUnique({
      where: { uuid },
      include: { studentCourse: { include: { group: true } } },
    });
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }
    return {
      uuid: row.uuid,
      order: row.order,
      teacherId: row.teacherId,
      start: row.start?.toISOString() ?? null,
      isFinished: row.isFinished,
      studentCourseUuid: row.studentCourseUuid,
      moduleClass: row.moduleClass,
      recommendation: row.recommendation,
      toManager: row.toManager,
      groupUuid: row.studentCourse.groupUuid,
    };
  }
}
