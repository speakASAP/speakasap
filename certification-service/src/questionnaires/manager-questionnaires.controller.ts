import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { QuestionnairesService } from './questionnaires.service';

@Controller('manager/user-questionnaires')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class ManagerQuestionnairesController {
  constructor(private readonly questionnaires: QuestionnairesService) {}

  @Get('completed')
  async listCompleted(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.questionnaires.listManagerCompleted(page, limit);
  }

  @Get('completed/:id')
  async getCompleted(@Param('id') id: string) {
    return this.questionnaires.getManagerCompletedDetail(Number(id));
  }
}
