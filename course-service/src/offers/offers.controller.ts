import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OffersService } from './offers.service';

@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.offers.list(page, limit, studentId);
  }

  @Get(':uuid')
  getOne(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.offers.getByUuid(uuid);
  }
}
