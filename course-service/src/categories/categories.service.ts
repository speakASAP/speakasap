import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse, getPaginationParams, type PaginatedResponse } from '../shared/pagination';

export type CategorySummary = {
  id: number;
  title: string;
  productForOffers: boolean;
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page?: string, limit?: string): Promise<PaginatedResponse<CategorySummary>> {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const where = {};
    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: l,
        orderBy: { id: 'asc' },
      }),
      this.prisma.category.count({ where }),
    ]);
    const mapped: CategorySummary[] = items.map((c) => ({
      id: c.id,
      title: c.title,
      productForOffers: c.productForOffers,
    }));
    return buildPaginatedResponse(mapped, total, p, l);
  }
}
