import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse, getPaginationParams } from '../shared/pagination';

@Injectable()
export class StudentCoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page?: string, limit?: string) {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const [items, total] = await Promise.all([
      this.prisma.studentCourse.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
        include: { group: { select: { uuid: true, title: true } } },
      }),
      this.prisma.studentCourse.count(),
    ]);
    const mapped = items.map((c) => ({
      uuid: c.uuid,
      courseClass: c.courseClass,
      courseDisplayTitle: c.courseDisplayTitle,
      createdAt: c.createdAt.toISOString(),
      groupUuid: c.groupUuid,
      groupTitle: c.group.title,
      isFinished: c.isFinished,
      isPaused: c.isPaused,
    }));
    return buildPaginatedResponse(mapped, total, p, l);
  }

  async getByUuid(uuid: string) {
    const row = await this.prisma.studentCourse.findUnique({
      where: { uuid },
      include: { group: true },
    });
    if (!row) {
      throw new NotFoundException('StudentCourse not found');
    }
    return {
      uuid: row.uuid,
      courseClass: row.courseClass,
      courseDisplayTitle: row.courseDisplayTitle,
      openStrategyClass: row.openStrategyClass,
      createdAt: row.createdAt.toISOString(),
      groupUuid: row.groupUuid,
      groupTitle: row.group.title,
      isFinished: row.isFinished,
      endDate: row.endDate?.toISOString() ?? null,
      isNew: row.isNew,
      isPaused: row.isPaused,
      autoPause: row.autoPause,
      pauseDate: row.pauseDate?.toISOString() ?? null,
      previousUuid: row.previousUuid,
    };
  }
}
