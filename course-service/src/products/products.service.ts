import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse, getPaginationParams, type PaginatedResponse } from '../shared/pagination';

export type ProductSummary = {
  id: number;
  title: string;
  enTitle: string;
  price: number;
  languageId: number | null;
  categoryId: number;
  label: string | null;
  materialLanguage: string;
  trashed: boolean;
};

export type ProductDetail = ProductSummary & {
  tags: string | null;
  androidId: string | null;
  partPaymentCollectionIds: number[];
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    page?: string,
    limit?: string,
    categoryId?: string,
    includeTrashed?: string,
  ): Promise<PaginatedResponse<ProductSummary>> {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const catNum = categoryId !== undefined && categoryId !== '' ? Number(categoryId) : NaN;
    const trashed = includeTrashed === 'true';
    const where = {
      ...(Number.isFinite(catNum) && !Number.isNaN(catNum) ? { categoryId: catNum } : {}),
      ...(trashed ? {} : { trashed: false }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: l,
        orderBy: { id: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    const items: ProductSummary[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      enTitle: r.enTitle,
      price: r.price,
      languageId: r.languageId,
      categoryId: r.categoryId,
      label: r.label,
      materialLanguage: r.materialLanguage,
      trashed: r.trashed,
    }));
    return buildPaginatedResponse(items, total, p, l);
  }

  async getById(id: number): Promise<ProductDetail> {
    const r = await this.prisma.product.findUnique({
      where: { id },
      include: { partPaymentLinks: true },
    });
    if (!r) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return {
      id: r.id,
      title: r.title,
      enTitle: r.enTitle,
      price: r.price,
      languageId: r.languageId,
      categoryId: r.categoryId,
      label: r.label,
      materialLanguage: r.materialLanguage,
      trashed: r.trashed,
      tags: r.tags,
      androidId: r.androidId,
      partPaymentCollectionIds: r.partPaymentLinks.map((l) => l.partPaymentCollectionId),
    };
  }
}
