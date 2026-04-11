import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuestionnairesService } from './questionnaires.service';

@Controller('questionnaires')
@UseGuards(JwtAuthGuard)
export class QuestionnairesCatalogController {
  constructor(private readonly questionnaires: QuestionnairesService) {}

  @Get()
  async list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.questionnaires.listCatalog(page, limit);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const numericId = Number(id);
    return this.questionnaires.getCatalogItem(numericId);
  }
}
