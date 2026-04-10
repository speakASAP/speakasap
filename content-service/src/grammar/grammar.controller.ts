import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { GrammarService, GrammarLessonResponse, GrammarCourseResponse } from './grammar.service';
import { PaginatedResponse } from '../shared/pagination';
import { AiClientService } from '../shared/ai-client.service';

@Controller('grammar')
export class GrammarController {
  private readonly logger = new Logger(GrammarController.name);

  constructor(
    private readonly grammarService: GrammarService,
    private readonly aiClientService: AiClientService,
  ) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('languageCode') languageCode?: string,
    @Query('materialLanguage') materialLanguage?: string,
    @Query('courseId') courseId?: string,
    @Query('section') section?: string,
    @Query('q') q?: string,
    @Query('order') order?: string,
    @Req() req?: Request,
  ): Promise<PaginatedResponse<GrammarLessonResponse>> {
    const start = Date.now();
    const parsedCourseId = courseId ? Number(courseId) : undefined;
    if (courseId && Number.isNaN(parsedCourseId)) {
      throw new BadRequestException('Invalid courseId');
    }
    const orderValue = order === 'desc' ? 'desc' : 'asc';
    this.logger.log(`Grammar lessons list request received`);
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        query: req?.query,
        ip: req?.ip,
      })}`,
    );

    const result = await this.grammarService.listLessons(page, limit, {
      languageCode,
      materialLanguage,
      courseId: parsedCourseId,
      section,
      q,
      order: orderValue,
    });
    this.logger.log(
      `Grammar lessons list response: count=${result.items.length} total=${result.total} latencyMs=${Date.now() - start}`,
    );
    return result;
  }

  @Get('courses')
  async listCourses(
    @Query('languageCode') languageCode?: string,
    @Query('materialLanguage') materialLanguage?: string,
    @Req() req?: Request,
  ): Promise<GrammarCourseResponse[]> {
    const start = Date.now();
    this.logger.log('Grammar courses request received');
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        query: req?.query,
        ip: req?.ip,
      })}`,
    );
    const result = await this.grammarService.listCourses(languageCode, materialLanguage);
    this.logger.log(`Grammar courses response: count=${result.length} latencyMs=${Date.now() - start}`);
    return result;
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req?: Request): Promise<GrammarLessonResponse> {
    const start = Date.now();
    const lessonId = Number(id);
    if (Number.isNaN(lessonId)) {
      throw new BadRequestException('Invalid id');
    }
    this.logger.log(`Grammar lesson detail request received: id=${lessonId}`);
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        params: req?.params,
        ip: req?.ip,
      })}`,
    );
    const result = await this.grammarService.getLessonById(lessonId);
    if (!result) {
      throw new NotFoundException('Grammar lesson not found');
    }
    this.logger.log(`Grammar lesson detail response: found=true latencyMs=${Date.now() - start}`);
    return result;
  }

  @Post('translate')
  async translate(
    @Body()
    body?: {
      text?: string;
      sourceLanguage?: string;
      targetLanguage?: string;
    },
    @Req() req?: Request,
  ): Promise<{ translatedText: string; durationMs: number; status: string }> {
    const start = Date.now();
    const text = body?.text?.trim();
    const targetLanguage = body?.targetLanguage?.trim();
    const sourceLanguage = body?.sourceLanguage?.trim();
    if (!text) {
      throw new BadRequestException('text is required');
    }
    if (!targetLanguage) {
      throw new BadRequestException('targetLanguage is required');
    }

    this.logger.log('Grammar translation request received');
    this.logger.debug(
      `Translation request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        ip: req?.ip,
        textLength: text.length,
        sourceLanguage: sourceLanguage || 'auto',
        targetLanguage,
      })}`,
    );

    const translated = await this.aiClientService.translate({
      text,
      sourceLanguage,
      targetLanguage,
    });
    this.logger.log(
      `Grammar translation response: status=success providerStatus=${translated.providerStatus} latencyMs=${Date.now() - start}`,
    );
    return {
      translatedText: translated.translatedText,
      durationMs: translated.durationMs,
      status: 'success',
    };
  }
}
