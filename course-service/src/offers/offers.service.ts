import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse, getPaginationParams, type PaginatedResponse } from '../shared/pagination';

export type OfferSummary = {
  uuid: string;
  studentId: number;
  teacherId: number | null;
  offererId: number | null;
  courseProductId: number | null;
  orderId: number | null;
  created: string;
  opened: string | null;
  state: string;
};

export type OfferDetail = OfferSummary & {
  extraLessons: {
    id: number;
    productId: number;
    lessons: number;
    lessonsNative: number;
    comment: string | null;
  } | null;
};

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page?: string, limit?: string, studentId?: string): Promise<PaginatedResponse<OfferSummary>> {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const sid = studentId !== undefined && studentId !== '' ? Number(studentId) : NaN;
    const where = Number.isFinite(sid) && !Number.isNaN(sid) ? { studentId: sid } : {};
    const [rows, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        skip,
        take: l,
        orderBy: { created: 'desc' },
      }),
      this.prisma.offer.count({ where }),
    ]);
    const items: OfferSummary[] = rows.map((o) => this.toSummary(o));
    return buildPaginatedResponse(items, total, p, l);
  }

  async getByUuid(uuid: string): Promise<OfferDetail> {
    const o = await this.prisma.offer.findUnique({
      where: { uuid },
      include: { extraLessons: true },
    });
    if (!o) {
      throw new NotFoundException(`Offer ${uuid} not found`);
    }
    const extra = o.extraLessons
      ? {
          id: o.extraLessons.id,
          productId: o.extraLessons.productId,
          lessons: o.extraLessons.lessons,
          lessonsNative: o.extraLessons.lessonsNative,
          comment: o.extraLessons.comment,
        }
      : null;
    return { ...this.toSummary(o), extraLessons: extra };
  }

  private toSummary(o: {
    uuid: string;
    studentId: number;
    teacherId: number | null;
    offererId: number | null;
    courseProductId: number | null;
    orderId: number | null;
    created: Date;
    opened: Date | null;
  }): OfferSummary {
    return {
      uuid: o.uuid,
      studentId: o.studentId,
      teacherId: o.teacherId,
      offererId: o.offererId,
      courseProductId: o.courseProductId,
      orderId: o.orderId,
      created: o.created.toISOString(),
      opened: o.opened ? o.opened.toISOString() : null,
      state: o.opened ? 'opened' : 'created',
    };
  }
}
