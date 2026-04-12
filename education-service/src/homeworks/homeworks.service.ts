import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse, getPaginationParams } from '../shared/pagination';

@Injectable()
export class HomeworksService {
  constructor(private readonly prisma: PrismaService) {}

  async listByLesson(lessonUuid: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const where = { lessonUuid };
    const [items, total] = await Promise.all([
      this.prisma.homework.findMany({
        where,
        orderBy: { uuid: 'asc' },
        skip,
        take: l,
      }),
      this.prisma.homework.count({ where }),
    ]);
    const mapped = items.map((h) => ({
      uuid: h.uuid,
      lessonUuid: h.lessonUuid,
      studentId: h.studentId,
      ready: h.ready,
      checked: h.checked,
    }));
    return buildPaginatedResponse(mapped, total, p, l);
  }

  async getByUuid(uuid: string) {
    const row = await this.prisma.homework.findUnique({
      where: { uuid },
      include: { lesson: true },
    });
    if (!row) {
      throw new NotFoundException('Homework not found');
    }
    return {
      uuid: row.uuid,
      lessonUuid: row.lessonUuid,
      studentId: row.studentId,
      contentStudent: row.contentStudent,
      contentTeacher: row.contentTeacher,
      ready: row.ready,
      comment: row.comment,
      checked: row.checked,
    };
  }
}
