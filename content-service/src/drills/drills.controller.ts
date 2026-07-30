import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { DrillsService } from './drills.service';
import { DrillItemSearchRequest, DrillItemSearchResponse, DrillTopicDTO } from './contracts';

// No @UseGuards here. content-service has no auth guard, no JWT/passport dependency,
// and no `src/auth/` directory to begin with — every other controller in this service
// (grammar, dictionary, phonetics, songs, languages, seven) is likewise unguarded.
// Auth is enforced upstream at the gateway (Track 0 already added these route prefixes
// there). Following the existing (unanimous) pattern rather than inventing a new
// in-service auth mechanism — see the task report for the full note.
@Controller()
export class DrillsController {
  private readonly logger = new Logger(DrillsController.name);

  constructor(private readonly drillsService: DrillsService) {}

  @Get('drill-topics')
  async listTopics(
    @Query('languageCode') languageCode?: string,
    @Query('materialLanguage') materialLanguage?: string,
    @Req() req?: Request,
  ): Promise<DrillTopicDTO[]> {
    const start = Date.now();
    this.logger.log(
      `Drill topics request received: languageCode=${languageCode || 'all'} materialLanguage=${materialLanguage || 'all'}`,
    );
    this.logger.debug(
      `Request details: ${JSON.stringify({ method: req?.method, path: req?.path, query: req?.query, ip: req?.ip })}`,
    );

    const result = await this.drillsService.listTopics(languageCode, materialLanguage);
    this.logger.log(`Drill topics response: count=${result.length} latencyMs=${Date.now() - start}`);
    return result;
  }

  @Post('drill-items/search')
  @HttpCode(HttpStatus.OK)
  async searchItems(
    @Body() body: DrillItemSearchRequest,
    @Req() req?: Request,
  ): Promise<DrillItemSearchResponse> {
    const start = Date.now();
    if (!body?.languageCode) {
      throw new BadRequestException('languageCode is required');
    }
    if (!body?.materialLanguage) {
      throw new BadRequestException('materialLanguage is required');
    }
    if (!Array.isArray(body?.topicSlugs)) {
      throw new BadRequestException('topicSlugs is required (may be an empty array)');
    }
    if (typeof body?.limit !== 'number' || body.limit <= 0) {
      throw new BadRequestException('limit is required and must be a positive number');
    }

    this.logger.log(
      `Drill items search request received: languageCode=${body.languageCode} topicSlugs=${body.topicSlugs.length} courseKey=${body.courseKey || 'none'}`,
    );
    this.logger.debug(
      `Request details: ${JSON.stringify({ method: req?.method, path: req?.path, ip: req?.ip })}`,
    );

    const result = await this.drillsService.searchItems(body);
    this.logger.log(
      `Drill items search response: returned=${result.items.length} totalAvailable=${result.totalAvailable} latencyMs=${Date.now() - start}`,
    );
    return result;
  }
}
