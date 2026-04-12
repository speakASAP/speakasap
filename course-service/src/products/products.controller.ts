import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('categoryId') categoryId?: string,
    @Query('includeTrashed') includeTrashed?: string,
  ) {
    return this.products.list(page, limit, categoryId, includeTrashed);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.products.getById(id);
  }
}
