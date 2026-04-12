import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PartPaymentCollectionsService } from './part-payment-collections.service';

@Controller('part-payment-collections')
@UseGuards(JwtAuthGuard)
export class PartPaymentCollectionsController {
  constructor(private readonly svc: PartPaymentCollectionsService) {}

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getById(id);
  }
}
