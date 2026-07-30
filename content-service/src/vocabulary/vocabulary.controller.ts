import { BadRequestException, Controller, Get, Logger, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { VocabularyService } from './vocabulary.service';
import { VocabularyBaseline } from '../drills/contracts';

@Controller()
export class VocabularyController {
  private readonly logger = new Logger(VocabularyController.name);

  constructor(private readonly vocabularyService: VocabularyService) {}

  // Internal-only: a course vocabulary baseline reveals exactly which words a
  // named student/course is assumed to already know, which is generation input
  // Track D uses to build answer-bearing drill sets — not something a student's
  // browser session needs or should be able to pull directly for an arbitrary
  // courseKey. Gateway-routed under /api/v1/internal/course-vocabulary, which
  // requires the x-internal-token header; no guard is added here (see
  // DrillsController for the same reasoning) — the gateway enforces this.
  @Get('internal/course-vocabulary')
  async getBaseline(
    @Query('courseKey') courseKey?: string,
    @Query('languageCode') languageCode?: string,
    @Query('maxLessonOrder') maxLessonOrder?: string,
    @Req() req?: Request,
  ): Promise<VocabularyBaseline> {
    const start = Date.now();
    if (!courseKey) {
      throw new BadRequestException('courseKey is required');
    }
    if (!languageCode) {
      throw new BadRequestException('languageCode is required');
    }
    const maxLessonOrderNumber = Number(maxLessonOrder);
    if (!maxLessonOrder || Number.isNaN(maxLessonOrderNumber)) {
      throw new BadRequestException('maxLessonOrder is required and must be a number');
    }

    this.logger.log(
      `Course vocabulary request received: courseKey=${courseKey} languageCode=${languageCode} maxLessonOrder=${maxLessonOrderNumber}`,
    );
    this.logger.debug(
      `Request details: ${JSON.stringify({ method: req?.method, path: req?.path, query: req?.query, ip: req?.ip })}`,
    );

    const result = await this.vocabularyService.getBaseline(courseKey, languageCode, maxLessonOrderNumber);
    this.logger.log(
      `Course vocabulary response: words=${result.words.length} hasBaseline=${result.hasBaseline} latencyMs=${Date.now() - start}`,
    );
    return result;
  }
}
