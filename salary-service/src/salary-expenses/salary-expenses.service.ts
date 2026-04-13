import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SalaryExpense, SalaryExpenseKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  decodeCursor,
  encodeCursor,
  ListEnvelope,
  parseListLimit,
} from '../shared/list-response';

function mapExpense(e: SalaryExpense) {
  return {
    id: e.id,
    profileId: e.profileId,
    legacyPortalUserId: e.legacyPortalUserId,
    date: e.date.toISOString().slice(0, 10),
    price: e.price.toString(),
    qty: e.qty.toString(),
    comment: e.comment,
    currency: e.currency,
    kind: e.kind,
    lessonUuid: e.lessonUuid ?? undefined,
    studentId: e.legacyStudentId ?? undefined,
    groupId: e.legacyStudentGroupId ?? undefined,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function mergeCursor(
  base: Prisma.SalaryExpenseWhereInput,
  cur: { t: string; id: string } | null,
): Prisma.SalaryExpenseWhereInput {
  if (!cur) {
    return base;
  }
  const c: Prisma.SalaryExpenseWhereInput = {
    OR: [
      { createdAt: { lt: new Date(cur.t) } },
      { AND: [{ createdAt: { equals: new Date(cur.t) } }, { id: { lt: cur.id } }] },
    ],
  };
  return Object.keys(base).length ? { AND: [base, c] } : c;
}

@Injectable()
export class SalaryExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    profileId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: string;
    cursor?: string;
  }): Promise<ListEnvelope<ReturnType<typeof mapExpense>>> {
    const limit = parseListLimit(params.limit);
    const cur = decodeCursor(params.cursor);
    const base: Prisma.SalaryExpenseWhereInput = {};
    if (params.profileId) {
      base.profileId = params.profileId;
    }
    if (params.dateFrom || params.dateTo) {
      base.date = {
        ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
        ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
      };
    }
    const where = mergeCursor(base, cur);
    const rows = await this.prisma.salaryExpense.findMany({
      where,
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
    return { data: data.map(mapExpense), meta: { nextCursor, limit } };
  }

  async getOne(expenseId: string) {
    const e = await this.prisma.salaryExpense.findUnique({ where: { id: expenseId } });
    if (!e) {
      throw new NotFoundException('Expense not found');
    }
    return mapExpense(e);
  }

  async create(body: {
    profileId: string;
    date: string;
    price: string;
    qty: string;
    comment?: string;
    currency: string;
    kind: SalaryExpenseKind;
    lessonUuid?: string;
    studentId?: number;
    groupId?: number;
  }) {
    const profile = await this.prisma.salaryProfile.findUnique({ where: { id: body.profileId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    const e = await this.prisma.salaryExpense.create({
      data: {
        profileId: body.profileId,
        legacyPortalUserId: profile.legacyPortalUserId,
        date: new Date(body.date),
        price: body.price,
        qty: body.qty,
        comment: body.comment ?? '',
        currency: body.currency,
        kind: body.kind,
        lessonUuid: body.lessonUuid,
        legacyStudentId: body.studentId,
        legacyStudentGroupId: body.groupId,
      },
    });
    return mapExpense(e);
  }

  async patch(
    expenseId: string,
    body: Partial<{
      date: string;
      price: string;
      qty: string;
      comment: string;
      currency: string;
      kind: SalaryExpenseKind;
      lessonUuid: string | null;
      studentId: number | null;
      groupId: number | null;
    }>,
  ) {
    const existing = await this.prisma.salaryExpense.findUnique({ where: { id: expenseId } });
    if (!existing) {
      throw new NotFoundException('Expense not found');
    }
    const data: Prisma.SalaryExpenseUpdateInput = {};
    if (body.date !== undefined) {
      data.date = new Date(body.date);
    }
    if (body.price !== undefined) {
      data.price = body.price;
    }
    if (body.qty !== undefined) {
      data.qty = body.qty;
    }
    if (body.comment !== undefined) {
      data.comment = body.comment;
    }
    if (body.currency !== undefined) {
      data.currency = body.currency;
    }
    if (body.kind !== undefined) {
      data.kind = body.kind;
    }
    if (body.lessonUuid !== undefined) {
      data.lessonUuid = body.lessonUuid;
    }
    if (body.studentId !== undefined) {
      data.legacyStudentId = body.studentId;
    }
    if (body.groupId !== undefined) {
      data.legacyStudentGroupId = body.groupId;
    }
    const e = await this.prisma.salaryExpense.update({ where: { id: expenseId }, data });
    return mapExpense(e);
  }
}
