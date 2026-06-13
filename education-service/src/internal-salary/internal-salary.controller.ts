import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { InternalSalaryService } from './internal-salary.service';

@Controller('internal/salary')
@UseGuards(InternalTokenGuard)
export class InternalSalaryController {
  constructor(private readonly salary: InternalSalaryService) {}

  @Get('period-aggregates')
  periodAggregates(
    @Query('period') period: string | undefined,
    @Query('legacyPortalUserIds') legacyPortalUserIds?: string,
  ) {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      throw new BadRequestException('period must be YYYY-MM');
    }
    const ids = parseCsvInts(legacyPortalUserIds);
    return this.salary.periodAggregates(period, ids);
  }
}

function parseCsvInts(raw: string | undefined): number[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  const out: number[] = [];
  for (const part of raw.split(',')) {
    const value = Number(part.trim());
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException('legacyPortalUserIds must be positive integers');
    }
    out.push(value);
  }
  return [...new Set(out)];
}
