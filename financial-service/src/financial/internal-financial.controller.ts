import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { FinancialAggregationService } from './financial-aggregation.service';
import { RefreshWindowDto } from './dto/refresh-window.dto';

@Controller('internal/financial')
@UseGuards(InternalTokenGuard)
export class InternalFinancialController {
  constructor(private readonly aggregation: FinancialAggregationService) {}

  @Post('refresh-window')
  refreshWindow(@Body() body: RefreshWindowDto) {
    return this.aggregation.refreshWindow(body.monthFrom, body.monthTo);
  }
}
