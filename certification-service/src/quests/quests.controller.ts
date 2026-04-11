import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuestsService } from './quests.service';

@Controller('quests')
export class QuestsController {
  constructor(private readonly quests: QuestsService) {}

  @Get(':questId')
  @UseGuards(JwtAuthGuard)
  async getOne(@Req() req: Request, @Param('questId') questId: string) {
    return this.quests.getQuest(questId, req.user!);
  }

  @Patch(':questId')
  @UseGuards(JwtAuthGuard)
  async patch(@Req() req: Request, @Param('questId') questId: string, @Body() body: { answers: Record<string, string> }) {
    return this.quests.patchQuest(questId, req.user!, body);
  }
}
