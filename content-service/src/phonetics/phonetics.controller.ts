import { BadRequestException, Controller, Get, Logger, NotFoundException, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { PhoneticsService, PhoneticsLessonResponse, PhoneticsCourseResponse } from './phonetics.service';
import { PaginatedResponse } from '../shared/pagination';

@Controller('phonetics')
export class PhoneticsController {
  private readonly logger = new Logger(PhoneticsController.name);

  constructor(private readonly phoneticsService: PhoneticsService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('languageCode') languageCode?: string,
    @Query('materialLanguage') materialLanguage?: string,
    @Query('courseId') courseId?: string,
    @Query('order') order?: string,
    @Req() req?: Request,
  ): Promise<PaginatedResponse<PhoneticsLessonResponse>> {
    const start = Date.now();
    const parsedCourseId = courseId ? Number(courseId) : undefined;
    if (courseId && Number.isNaN(parsedCourseId)) {
      throw new BadRequestException('Invalid courseId');
    }
    const orderValue = order === 'desc' ? 'desc' : 'asc';
    this.logger.log('Phonetics lessons list request received');
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        query: req?.query,
        ip: req?.ip,
      })}`,
    );

    const result = await this.phoneticsService.listLessons(page, limit, {
      languageCode,
      materialLanguage,
      courseId: parsedCourseId,
      order: orderValue,
    });
    this.logger.log(
      `Phonetics lessons list response: count=${result.items.length} total=${result.total} latencyMs=${Date.now() - start}`,
    );
    return result;
  }

  @Get('courses')
  async listCourses(
    @Query('languageCode') languageCode?: string,
    @Query('materialLanguage') materialLanguage?: string,
    @Req() req?: Request,
  ): Promise<PhoneticsCourseResponse[]> {
    const start = Date.now();
    this.logger.log('Phonetics courses request received');
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        query: req?.query,
        ip: req?.ip,
      })}`,
    );
    const result = await this.phoneticsService.listCourses(languageCode, materialLanguage);
    this.logger.log(`Phonetics courses response: count=${result.length} latencyMs=${Date.now() - start}`);
    return result;
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req?: Request): Promise<PhoneticsLessonResponse> {
    const start = Date.now();
    const lessonId = Number(id);
    if (Number.isNaN(lessonId)) {
      throw new BadRequestException('Invalid id');
    }
    this.logger.log(`Phonetics lesson detail request received: id=${lessonId}`);
    this.logger.debug(
      `Request details: ${JSON.stringify({
        method: req?.method,
        path: req?.path,
        params: req?.params,
        ip: req?.ip,
      })}`,
    );
    const result = await this.phoneticsService.getLessonById(lessonId);
    if (!result) {
      throw new NotFoundException('Phonetics lesson not found');
    }
    this.logger.log(`Phonetics lesson detail response: found=true latencyMs=${Date.now() - start}`);
    return result;
  }
}
