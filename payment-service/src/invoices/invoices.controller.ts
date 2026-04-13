import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PatchInvoiceDto } from './dto/patch-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('userId') userId?: string,
    @Query('received') received?: string,
  ): Promise<unknown> {
    return this.invoices.list(req.authUser!, limit, cursor, userId, received);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateInvoiceDto): Promise<unknown> {
    return this.invoices.create(req.authUser!, dto);
  }

  @Get(':invoiceId')
  async get(@Req() req: Request, @Param('invoiceId') invoiceId: string): Promise<unknown> {
    return this.invoices.get(req.authUser!, invoiceId);
  }

  @Patch(':invoiceId')
  async patch(
    @Req() req: Request,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: PatchInvoiceDto,
  ): Promise<unknown> {
    return this.invoices.patch(req.authUser!, invoiceId, dto);
  }
}
