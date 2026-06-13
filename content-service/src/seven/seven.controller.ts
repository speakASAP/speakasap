import { BadRequestException, Controller, Get, Logger, NotFoundException, Param, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { SevenCourseResponse, SevenLessonDetailResponse, SevenLessonSummaryResponse, SevenService } from "./seven.service";

@Controller("seven")
export class SevenController {
  private readonly logger = new Logger(SevenController.name);

  constructor(private readonly sevenService: SevenService) {}

  @Get("courses")
  async listCourses(
    @Query("languageCode") languageCode?: string,
    @Query("materialLanguage") materialLanguage?: string,
    @Req() req?: Request,
  ): Promise<SevenCourseResponse[]> {
    const start = Date.now();
    this.logger.log("Seven courses list request received");
    this.logger.debug(
      "Request details: " + JSON.stringify({ method: req?.method, path: req?.path, query: req?.query, ip: req?.ip }),
    );
    const result = await this.sevenService.listCourses(languageCode, materialLanguage);
    this.logger.log("Seven courses list response: count=" + result.length + " latencyMs=" + (Date.now() - start));
    return result;
  }

  @Get("courses/:languageCode")
  async getCourse(
    @Param("languageCode") languageCode: string,
    @Query("materialLanguage") materialLanguage?: string,
    @Req() req?: Request,
  ): Promise<SevenCourseResponse> {
    const start = Date.now();
    this.logger.log("Seven course detail request received: languageCode=" + languageCode);
    this.logger.debug(
      "Request details: " + JSON.stringify({ method: req?.method, path: req?.path, params: req?.params, ip: req?.ip }),
    );
    const result = await this.sevenService.getCourse(languageCode, materialLanguage);
    if (!result) {
      throw new NotFoundException("Seven course not found");
    }
    this.logger.log("Seven course detail response: found=true latencyMs=" + (Date.now() - start));
    return result;
  }

  @Get("courses/:languageCode/lessons")
  async listLessons(
    @Param("languageCode") languageCode: string,
    @Query("materialLanguage") materialLanguage?: string,
    @Req() req?: Request,
  ): Promise<SevenLessonSummaryResponse[]> {
    const start = Date.now();
    this.logger.log("Seven lessons list request received: languageCode=" + languageCode);
    this.logger.debug(
      "Request details: " + JSON.stringify({ method: req?.method, path: req?.path, params: req?.params, ip: req?.ip }),
    );
    const result = await this.sevenService.listLessons(languageCode, materialLanguage);
    if (!result) {
      throw new NotFoundException("Seven course not found");
    }
    this.logger.log("Seven lessons list response: count=" + result.length + " latencyMs=" + (Date.now() - start));
    return result;
  }

  @Get("courses/:languageCode/lessons/:order")
  async getLesson(
    @Param("languageCode") languageCode: string,
    @Param("order") order: string,
    @Query("materialLanguage") materialLanguage?: string,
    @Req() req?: Request,
  ): Promise<SevenLessonDetailResponse> {
    const start = Date.now();
    const parsedOrder = Number(order);
    if (!Number.isInteger(parsedOrder) || parsedOrder < 1) {
      throw new BadRequestException("Invalid lesson order");
    }
    this.logger.log("Seven lesson detail request received: languageCode=" + languageCode + " order=" + parsedOrder);
    this.logger.debug(
      "Request details: " + JSON.stringify({ method: req?.method, path: req?.path, params: req?.params, ip: req?.ip }),
    );
    const result = await this.sevenService.getLesson(languageCode, parsedOrder, materialLanguage);
    if (!result) {
      throw new NotFoundException("Seven lesson not found");
    }
    this.logger.log("Seven lesson detail response: found=true latencyMs=" + (Date.now() - start));
    return result;
  }
}
