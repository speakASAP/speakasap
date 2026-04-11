import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuestionnairesService } from './questionnaires.service';

@Controller('user-questionnaires')
@UseGuards(JwtAuthGuard)
export class UserQuestionnairesController {
  constructor(private readonly questionnaires: QuestionnairesService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('status') status: 'incomplete' | 'completed' = 'incomplete',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
  ) {
    const st = status === 'completed' ? 'completed' : 'incomplete';
    return this.questionnaires.listUserQuestionnaires(req.user!, st, page, limit, userId);
  }

  @Get(':id')
  async getDetail(@Req() req: Request, @Param('id') id: string) {
    return this.questionnaires.getUserQuestionnaireDetail(Number(id), req.user!);
  }

  @Post(':id/submit')
  async submit(@Req() req: Request, @Param('id') id: string, @Body() body: { answer: Record<string, string> }) {
    await this.questionnaires.submitUserQuestionnaire(Number(id), req.user!, body);
    return { ok: true };
  }
}
