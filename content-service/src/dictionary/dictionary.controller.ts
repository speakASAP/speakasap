import { BadRequestException, Controller, Get, Logger, NotFoundException, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  DictionaryService,
  DictionaryEntryResponse,
  DictionaryThemeResponse,
} from './dictionary.service';
import { PaginatedResponse } from '../shared/pagination';

@Controller('dictionary')
export class DictionaryController {
  private readonly logger = new Logger(DictionaryController.name);

  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('languageCode') languageCode?: string,
    @Query('themeId') themeId?: string,
    @Query('q') q?: string,
    @Query('order') order?: string,
    @Req() req?: Request,
  ): Promise<PaginatedResponse<DictionaryEntryResponse>> {
    const start = Date.now();
    const parsedThemeId = themeId ? Number(themeId) : undefined;
    if (themeId && Number.isNaN(parsedThemeId)) {
      throw new BadRequestException('Invalid themeId');
    }
    const orderValue = order === 'desc' ? 'desc' : 'asc';
    this.logger.log('Dictionary entries list request received');
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        query: req?.query,
        ip: req?.ip,
      })}`,
    );

    const result = await this.dictionaryService.listEntries(page, limit, {
      languageCode,
      themeId: parsedThemeId,
      q,
      order: orderValue,
    });
    this.logger.log(
      `Dictionary entries list response: count=${result.items.length} total=${result.total} latencyMs=${Date.now() - start}`,
    );
    return result;
  }

  @Get('themes')
  async listThemes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('order') order?: string,
    @Req() req?: Request,
  ): Promise<PaginatedResponse<DictionaryThemeResponse>> {
    const start = Date.now();
    const orderValue = order === 'desc' ? 'desc' : 'asc';
    this.logger.log('Dictionary themes list request received');
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        query: req?.query,
        ip: req?.ip,
      })}`,
    );
    const result = await this.dictionaryService.listThemes(page, limit, q, orderValue);
    this.logger.log(
      `Dictionary themes response: count=${result.items.length} total=${result.total} latencyMs=${Date.now() - start}`,
    );
    return result;
  }

  @Get('themes/:id')
  async getThemeById(@Param('id') id: string, @Req() req?: Request): Promise<DictionaryThemeResponse> {
    const start = Date.now();
    const themeId = Number(id);
    if (Number.isNaN(themeId)) {
      throw new BadRequestException('Invalid id');
    }
    this.logger.log(`Dictionary theme detail request received: id=${themeId}`);
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        params: req?.params,
        ip: req?.ip,
      })}`,
    );
    const result = await this.dictionaryService.getThemeById(themeId);
    if (!result) {
      throw new NotFoundException('Dictionary theme not found');
    }
    this.logger.log(`Dictionary theme detail response: found=true latencyMs=${Date.now() - start}`);
    return result;
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req?: Request): Promise<DictionaryEntryResponse> {
    const start = Date.now();
    const entryId = Number(id);
    if (Number.isNaN(entryId)) {
      throw new BadRequestException('Invalid id');
    }
    this.logger.log(`Dictionary entry detail request received: id=${entryId}`);
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        params: req?.params,
        ip: req?.ip,
      })}`,
    );
    const result = await this.dictionaryService.getEntryById(entryId);
    if (!result) {
      throw new NotFoundException('Dictionary entry not found');
    }
    this.logger.log(`Dictionary entry detail response: found=true latencyMs=${Date.now() - start}`);
    return result;
  }
}
