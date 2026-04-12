import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PartPaymentCollectionDetail = {
  id: number;
  title: string;
  comment: string | null;
  options: Array<{
    id: number;
    price: number;
    day: number;
    openSteps: string | null;
  }>;
};

@Injectable()
export class PartPaymentCollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: number): Promise<PartPaymentCollectionDetail> {
    const row = await this.prisma.partPaymentCollection.findUnique({
      where: { id },
      include: { options: { orderBy: { id: 'asc' } } },
    });
    if (!row) {
      throw new NotFoundException(`Part payment collection ${id} not found`);
    }
    return {
      id: row.id,
      title: row.title,
      comment: row.comment,
      options: row.options.map((o) => ({
        id: o.id,
        price: o.price,
        day: o.day,
        openSteps: o.openSteps,
      })),
    };
  }
}
