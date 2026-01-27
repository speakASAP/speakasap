import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { buildPaginatedResponse, getPaginationParams, PaginatedResponse } from '../shared/pagination';

export type LanguageResponse = {
  id: number;
  code: string;
  machineName: string;
  name: string;
  iconUrl: string;
  order: number;
  speaker: string;
};

@Injectable()
export class LanguagesService {
  private readonly logger = new Logger(LanguagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    page?: string,
    limit?: string,
    q?: string,
    order?: 'asc' | 'desc',
  ): Promise<PaginatedResponse<LanguageResponse>> {
    const { page: pageNumber, limit: limitNumber, skip } = getPaginationParams(page, limit);
    const orderBy = order === 'desc' ? 'desc' : 'asc';

    this.logger.debug(`Languages list: page=${pageNumber} limit=${limitNumber} query=${q || 'none'}`);

    const whereClause = q
      ? {
          name: { contains: q, mode: 'insensitive' as const },
        }
      : {};

    const [total, languages] = await Promise.all([
      this.prisma.language.count({ where: whereClause }),
      this.prisma.language.findMany({
        where: whereClause,
        orderBy: [{ order: orderBy }, { name: orderBy }],
        skip,
        take: limitNumber,
      }),
    ]);

    const assetsBaseUrl = (process.env.ASSETS_BASE_URL || '').replace(/\/$/, '');

    return buildPaginatedResponse(
      languages.map((language) => ({
        id: language.id,
        code: language.code,
        machineName: language.machineName,
        name: language.name,
        iconUrl: assetsBaseUrl ? `${assetsBaseUrl}/${language.iconPath}` : language.iconPath,
        order: language.order,
        speaker: language.speaker,
      })),
      total,
      pageNumber,
      limitNumber,
    );
  }

  async getByCode(code: string): Promise<LanguageResponse | null> {
    this.logger.debug(`Language detail: code=${code}`);
    const language = await this.prisma.language.findUnique({
      where: { code },
    });
    if (!language) {
      return null;
    }
    const assetsBaseUrl = (process.env.ASSETS_BASE_URL || '').replace(/\/$/, '');
    return {
      id: language.id,
      code: language.code,
      machineName: language.machineName,
      name: language.name,
      iconUrl: assetsBaseUrl ? `${assetsBaseUrl}/${language.iconPath}` : language.iconPath,
      order: language.order,
      speaker: language.speaker,
    };
  }
}
