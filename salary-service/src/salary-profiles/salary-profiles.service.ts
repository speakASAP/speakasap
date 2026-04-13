import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SalaryProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  decodeCursor,
  encodeCursor,
  ListEnvelope,
  parseListLimit,
} from '../shared/list-response';

function mapProfile(p: SalaryProfile) {
  return {
    id: p.id,
    legacyPortalUserId: p.legacyPortalUserId,
    authUserId: p.authUserId ?? undefined,
    currency: p.currency,
    preferablePm: p.preferablePm,
    salary: p.salary.toString(),
    rate: p.rate.toString(),
    showAsTeacher: p.showAsTeacher,
    showAsOther: p.showAsOther,
    bankAccount: p.bankAccount ?? undefined,
    paypalAccount: p.paypalAccount ?? undefined,
    workDurationLowerBound: p.workDurationLowerBound ?? undefined,
    workDurationUpperBound: p.workDurationUpperBound ?? undefined,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class SalaryProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    dateFrom?: string;
    dateTo?: string;
    filter?: string;
    limit?: string;
    cursor?: string;
  }): Promise<ListEnvelope<ReturnType<typeof mapProfile>>> {
    const limit = parseListLimit(params.limit);
    const cur = decodeCursor(params.cursor);
    const where: Prisma.SalaryProfileWhereInput = {};
    if (params.dateFrom || params.dateTo) {
      where.expenses = {
        some: {
          date: {
            ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
            ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
          },
        },
      };
    }
    if (params.filter === 'teachers') {
      where.showAsTeacher = true;
    } else if (params.filter === 'other') {
      where.showAsOther = true;
    }
    const cursorWhere: Prisma.SalaryProfileWhereInput | undefined = cur
      ? {
          OR: [
            { createdAt: { lt: new Date(cur.t) } },
            { AND: [{ createdAt: { equals: new Date(cur.t) } }, { id: { lt: cur.id } }] },
          ],
        }
      : undefined;
    const mergedWhere: Prisma.SalaryProfileWhereInput =
      cursorWhere && Object.keys(where).length
        ? { AND: [where, cursorWhere] }
        : cursorWhere
          ? cursorWhere
          : where;
    const rows = await this.prisma.salaryProfile.findMany({
      where: mergedWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    let nextCursor: string | null = null;
    let data = rows;
    if (rows.length > limit) {
      data = rows.slice(0, limit);
      const last = data[data.length - 1];
      nextCursor = encodeCursor({ t: last.createdAt.toISOString(), id: last.id });
    }
    return { data: data.map(mapProfile), meta: { nextCursor, limit } };
  }

  async getOne(profileId: string) {
    const p = await this.prisma.salaryProfile.findUnique({ where: { id: profileId } });
    if (!p) {
      throw new NotFoundException('Profile not found');
    }
    return mapProfile(p);
  }

  async patch(
    profileId: string,
    body: Partial<{
      currency: string;
      preferablePm: string | null;
      salary: string;
      rate: string;
      showAsTeacher: boolean;
      showAsOther: boolean;
    }>,
  ) {
    const existing = await this.prisma.salaryProfile.findUnique({ where: { id: profileId } });
    if (!existing) {
      throw new NotFoundException('Profile not found');
    }
    const data: Prisma.SalaryProfileUpdateInput = {};
    if (body.currency !== undefined) {
      data.currency = body.currency;
    }
    if (body.preferablePm !== undefined) {
      data.preferablePm = body.preferablePm;
    }
    if (body.salary !== undefined) {
      data.salary = body.salary;
    }
    if (body.rate !== undefined) {
      data.rate = body.rate;
    }
    if (body.showAsTeacher !== undefined) {
      data.showAsTeacher = body.showAsTeacher;
    }
    if (body.showAsOther !== undefined) {
      data.showAsOther = body.showAsOther;
    }
    const p = await this.prisma.salaryProfile.update({ where: { id: profileId }, data });
    return mapProfile(p);
  }
}
