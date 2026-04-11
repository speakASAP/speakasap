import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffRolesGuard } from '../auth/staff-roles.guard';
import { AdminLanguageTestsService } from './admin-language-tests.service';

@Controller('admin/language-tests')
@UseGuards(JwtAuthGuard, StaffRolesGuard)
export class AdminLanguageTestsController {
  constructor(private readonly admin: AdminLanguageTestsService) {}

  @Get('levels')
  listLevels() {
    return this.admin.listLevels();
  }

  @Get('questions/:questionId/answers')
  listAnswers(@Param('questionId', ParseIntPipe) questionId: number) {
    return this.admin.listAnswersForQuestion(questionId);
  }

  @Post('questions/:questionId/answers')
  createAnswer(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: { text: string; isCorrect: boolean },
  ) {
    return this.admin.createAnswer(questionId, body);
  }

  @Get('answers/:answerId')
  getAnswer(@Param('answerId', ParseIntPipe) answerId: number) {
    return this.admin.getAnswer(answerId);
  }

  @Patch('answers/:answerId')
  patchAnswer(
    @Param('answerId', ParseIntPipe) answerId: number,
    @Body() body: Partial<{ text: string; isCorrect: boolean; isTrashed: boolean }>,
  ) {
    return this.admin.patchAnswer(answerId, body);
  }

  @Delete('answers/:answerId')
  deleteAnswer(@Param('answerId', ParseIntPipe) answerId: number) {
    return this.admin.deleteAnswer(answerId);
  }

  @Get('questions/:questionId')
  getQuestion(@Param('questionId', ParseIntPipe) questionId: number) {
    return this.admin.getQuestion(questionId);
  }

  @Patch('questions/:questionId')
  patchQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: Partial<{ text: string; levelId: number; isTrashed: boolean }>,
  ) {
    return this.admin.patchQuestion(questionId, body);
  }

  @Delete('questions/:questionId')
  deleteQuestion(@Param('questionId', ParseIntPipe) questionId: number) {
    return this.admin.deleteQuestion(questionId);
  }

  @Get(':testId/questions')
  listQuestions(@Param('testId', ParseIntPipe) testId: number) {
    return this.admin.listQuestionsForTest(testId);
  }

  @Post(':testId/questions')
  createQuestion(
    @Param('testId', ParseIntPipe) testId: number,
    @Body() body: { text: string; levelId: number },
  ) {
    return this.admin.createQuestion(testId, body);
  }

  @Get(':testId')
  getOne(@Param('testId', ParseIntPipe) testId: number) {
    return this.admin.getLanguageTestCatalogItem(testId);
  }

  @Patch(':testId')
  patchTest(
    @Param('testId', ParseIntPipe) testId: number,
    @Body() body: Partial<{
      name: string;
      tag: string;
      languageId: number;
      languageCode: string;
      languageName: string;
    }>,
  ) {
    return this.admin.patchLanguageTest(testId, body);
  }

  @Get()
  listTests(@Query() query: Record<string, unknown>) {
    return this.admin.listLanguageTests(query);
  }

  @Post()
  createTest(
    @Body()
    body: {
      name: string;
      tag: string;
      languageId: number;
      languageCode: string;
      languageName: string;
    },
  ) {
    return this.admin.createLanguageTest(body);
  }
}
