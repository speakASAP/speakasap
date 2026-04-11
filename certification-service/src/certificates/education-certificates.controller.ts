import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EducationCertificatesService } from './education-certificates.service';

@Controller('education-certificates')
export class EducationCertificatesController {
  constructor(private readonly educationCertificates: EducationCertificatesService) {}

  @Get('public/:viewToken')
  async getPublic(@Param('viewToken') viewToken: string): Promise<{ imageUrl: string; certText: string }> {
    return this.educationCertificates.getPublicByToken(viewToken);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: Request, @Query('page') page?: string, @Query('limit') limit?: string) {
    const user = req.user!;
    return this.educationCertificates.listForUser(user.sub, page, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@Req() req: Request, @Param('id') id: string) {
    const user = req.user!;
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw new BadRequestException('Invalid certificate id');
    }
    return this.educationCertificates.getByIdForUser(numericId, user);
  }
}
