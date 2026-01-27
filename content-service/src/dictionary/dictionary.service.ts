import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { buildPaginatedResponse, getPaginationParams, PaginatedResponse } from '../shared/pagination';

export type DictionaryEntryResponse = {
  id: number;
  word: string;
  transcription: string | null;
  translation: string | null;
  languageId: number;
};

export type DictionaryThemeResponse = {
  id: number;
  name: string;
  moduleClass: string;
  order: number;
};

@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listEntries(
    page?: string,
    limit?: string,
    filters?: {
      languageCode?: string;
      themeId?: number;
      q?: string;
      order?: 'asc' | 'desc';
    },
  ): Promise<PaginatedResponse<DictionaryEntryResponse>> {
    const { page: pageNumber, limit: limitNumber, skip } = getPaginationParams(page, limit);
    const orderBy = filters?.order === 'desc' ? 'desc' : 'asc';

    this.logger.debug(
      `Dictionary entries list: page=${pageNumber} limit=${limitNumber} languageCode=${filters?.languageCode || 'all'}`,
    );

    const whereClause = {
      ...(filters?.languageCode ? { language: { code: filters.languageCode } } : {}),
      ...(filters?.themeId ? { themes: { some: { themeId: filters.themeId } } } : {}),
      ...(filters?.q
        ? {
            OR: [
              { word: { contains: filters.q, mode: 'insensitive' as const } },
              { translation: { contains: filters.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, entries] = await Promise.all([
      this.prisma.word.count({ where: whereClause }),
      this.prisma.word.findMany({
        where: whereClause,
        orderBy: { word: orderBy },
        skip,
        take: limitNumber,
      }),
    ]);

    this.logger.debug(`Dictionary entries fetched: total=${total} returned=${entries.length}`);

    return buildPaginatedResponse(
      entries.map((entry) => ({
        id: entry.id,
        word: entry.word,
        transcription: entry.transcription,
        translation: entry.translation,
        languageId: entry.languageId,
      })),
      total,
      pageNumber,
      limitNumber,
    );
  }

  async getEntryById(entryId: number): Promise<DictionaryEntryResponse | null> {
    this.logger.debug(`Dictionary entry detail: id=${entryId}`);
    const entry = await this.prisma.word.findUnique({
      where: { id: entryId },
    });
    if (!entry) {
      return null;
    }
    return {
      id: entry.id,
      word: entry.word,
      transcription: entry.transcription,
      translation: entry.translation,
      languageId: entry.languageId,
    };
  }

  async listThemes(
    page?: string,
    limit?: string,
    q?: string,
    order?: 'asc' | 'desc',
  ): Promise<PaginatedResponse<DictionaryThemeResponse>> {
    const { page: pageNumber, limit: limitNumber, skip } = getPaginationParams(page, limit);
    const orderBy = order === 'desc' ? 'desc' : 'asc';

    this.logger.debug(`Dictionary themes list: page=${pageNumber} limit=${limitNumber} query=${q || 'none'}`);

    const whereClause = q
      ? {
          name: { contains: q, mode: 'insensitive' as const },
        }
      : {};

    const [total, themes] = await Promise.all([
      this.prisma.wordTheme.count({ where: whereClause }),
      this.prisma.wordTheme.findMany({
        where: whereClause,
        orderBy: { order: orderBy },
        skip,
        take: limitNumber,
      }),
    ]);

    return buildPaginatedResponse(
      themes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        moduleClass: theme.moduleClass,
        order: theme.order,
      })),
      total,
      pageNumber,
      limitNumber,
    );
  }

  async getThemeById(themeId: number): Promise<DictionaryThemeResponse | null> {
    this.logger.debug(`Dictionary theme detail: id=${themeId}`);
    const theme = await this.prisma.wordTheme.findUnique({
      where: { id: themeId },
    });
    if (!theme) {
      return null;
    }
    return {
      id: theme.id,
      name: theme.name,
      moduleClass: theme.moduleClass,
      order: theme.order,
    };
  }
}
