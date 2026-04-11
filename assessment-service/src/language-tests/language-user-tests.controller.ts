import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { LanguageUserTestsService } from './language-user-tests.service';

@Controller('language-user-tests')
export class LanguageUserTestsController {
  constructor(private readonly languageUserTests: LanguageUserTestsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  start(@Req() req: Request, @Body() body: { languageCode: string; tag: string }) {
    return this.languageUserTests.startUserTest(req.user!.id, body);
  }

  @Get('results/:viewToken')
  @UseGuards(OptionalJwtAuthGuard)
  getResult(@Param('viewToken') viewToken: string) {
    return this.languageUserTests.getPublicResult(viewToken);
  }

  @Patch('questions/:userQuestionId')
  @UseGuards(JwtAuthGuard)
  patchQuestion(
    @Req() req: Request,
    @Param('userQuestionId', ParseIntPipe) userQuestionId: number,
    @Body() body: { check: number[] },
  ) {
    return this.languageUserTests.patchUserQuestion(userQuestionId, req.user!.id, body);
  }

  @Get(':testId/current-question')
  @UseGuards(JwtAuthGuard)
  current(@Req() req: Request, @Param('testId', ParseIntPipe) testId: number) {
    return this.languageUserTests.getCurrentQuestion(testId, req.user!.id);
  }

  @Get(':testId')
  @UseGuards(JwtAuthGuard)
  getState(@Req() req: Request, @Param('testId', ParseIntPipe) testId: number) {
    return this.languageUserTests.getUserTestState(testId, req.user!.id);
  }
}
