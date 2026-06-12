import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LessonRecordsService } from './lesson-records.service';

function bearerToken(req: Request): string {
  const header = req.headers.authorization || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

@Controller('lessons/:lessonUuid/record')
export class LessonRecordsController {
  constructor(private readonly records: LessonRecordsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getState(@Req() req: Request, @Param('lessonUuid') lessonUuid: string) {
    return this.records.getState(lessonUuid, req.authUser!, bearerToken(req));
  }

  @Get('playback')
  @UseGuards(JwtAuthGuard)
  getPlayback(@Req() req: Request, @Param('lessonUuid') lessonUuid: string) {
    return this.records.createPlaybackAccess(lessonUuid, req.authUser!, bearerToken(req));
  }

  @Get('download')
  download(
    @Param('lessonUuid') lessonUuid: string,
    @Query('token') token: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ) {
    return this.records.streamDownload(lessonUuid, token, rangeHeader, res);
  }

  @Post('presign')
  @UseGuards(JwtAuthGuard)
  presign(@Req() req: Request, @Param('lessonUuid') lessonUuid: string, @Body() _body: Record<string, unknown>) {
    return this.records.presignUpload(lessonUuid, req.authUser!, bearerToken(req));
  }

  @Post('commit')
  @UseGuards(JwtAuthGuard)
  commit(@Req() req: Request, @Param('lessonUuid') lessonUuid: string, @Body() _body: Record<string, unknown>) {
    return this.records.commitUpload(lessonUuid, req.authUser!, bearerToken(req));
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  merge(@Req() req: Request, @Param('lessonUuid') lessonUuid: string) {
    return this.records.requestMerge(lessonUuid, req.authUser!, bearerToken(req));
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  delete(@Req() req: Request, @Param('lessonUuid') lessonUuid: string) {
    return this.records.deleteRecord(lessonUuid, req.authUser!, bearerToken(req));
  }
}
