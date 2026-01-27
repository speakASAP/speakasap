import { Controller, Get, Logger, NotFoundException, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { LanguagesService, LanguageResponse } from './languages.service';
import { PaginatedResponse } from '../shared/pagination';

@Controller('languages')
export class LanguagesController {
  private readonly logger = new Logger(LanguagesController.name);

  constructor(private readonly languagesService: LanguagesService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('order') order?: string,
    @Req() req?: Request,
  ): Promise<PaginatedResponse<LanguageResponse>> {
    const start = Date.now();
    const orderValue = order === 'desc' ? 'desc' : 'asc';
    this.logger.log('Languages list request received');
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        query: req?.query,
        ip: req?.ip,
      })}`,
    );

    const result = await this.languagesService.list(page, limit, q, orderValue);
    this.logger.log(
      `Languages list response: count=${result.items.length} total=${result.total} latencyMs=${Date.now() - start}`,
    );
    return result;
  }

  @Get(':code')
  async getByCode(@Param('code') code: string, @Req() req?: Request): Promise<LanguageResponse> {
    const start = Date.now();
    this.logger.log(`Language detail request received: code=${code}`);
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        params: req?.params,
        ip: req?.ip,
      })}`,
    );

    const result = await this.languagesService.getByCode(code);
    if (!result) {
      throw new NotFoundException('Language not found');
    }
    this.logger.log(`Language detail response: found=true latencyMs=${Date.now() - start}`);
    return result;
  }
}
