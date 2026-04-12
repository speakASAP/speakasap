import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse, getPaginationParams } from '../shared/pagination';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page?: string, limit?: string) {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const [items, total] = await Promise.all([
      this.prisma.group.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
        include: { _count: { select: { groupStudents: true, studentCourses: true } } },
      }),
      this.prisma.group.count(),
    ]);
    const mapped = items.map((g) => ({
      uuid: g.uuid,
      title: g.title,
      createdAt: g.createdAt.toISOString(),
      studentCount: g._count.groupStudents,
      studentCourseCount: g._count.studentCourses,
    }));
    return buildPaginatedResponse(mapped, total, p, l);
  }

  async getByUuid(uuid: string) {
    return this.prisma.group.findUnique({
      where: { uuid },
      include: {
        groupStudents: { take: 30, orderBy: { id: 'asc' } },
        studentCourses: { take: 30, orderBy: { createdAt: 'desc' } },
      },
    });
  }
}
