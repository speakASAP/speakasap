import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CourseCertificate } from '@prisma/client';
import { PrismaService } from '../shared/prisma.service';
import { buildPaginatedResponse, getPaginationParams, PaginatedResponse } from '../shared/pagination';
import { buildPublicAssetUrl } from '../shared/public-asset-url';
import { ViewTokenService } from './view-token.service';

export type CourseCertificateSummary = {
  id: number;
  studentCourseId: string;
  imageUrl: string;
  signedViewToken: string;
  certText: string;
  createdAt: string;
};

@Injectable()
export class CourseCertificatesService {
  private readonly logger = new Logger(CourseCertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly viewTokens: ViewTokenService,
  ) {}

  async listForUser(userId: string, page?: string, limit?: string): Promise<PaginatedResponse<CourseCertificateSummary>> {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const where = { ownerUserId: userId };
    const [rows, total] = await Promise.all([
      this.prisma.courseCertificate.findMany({ where, orderBy: { id: 'desc' }, skip, take: l }),
      this.prisma.courseCertificate.count({ where }),
    ]);
    return buildPaginatedResponse(rows.map((r) => this.toSummary(r)), total, p, l);
  }

  async getByIdForUser(id: number, userId: string): Promise<CourseCertificateSummary & { courseCode?: string; languageCode?: string }> {
    const row = await this.prisma.courseCertificate.findUnique({ where: { id } });
    if (!row || row.ownerUserId !== userId) {
      throw new NotFoundException('Certificate not found');
    }
    return this.toSummary(row);
  }

  async getPublicByToken(token: string): Promise<{ imageUrl: string; certText: string }> {
    const payload = this.viewTokens.verify(token);
    if (!payload || payload.k !== 'cc') {
      throw new NotFoundException('Invalid or expired link');
    }
    const row = await this.prisma.courseCertificate.findUnique({ where: { id: payload.id } });
    if (!row) {
      throw new NotFoundException('Certificate not found');
    }
    return {
      imageUrl: buildPublicAssetUrl(row.imagePath),
      certText: row.certText ?? '',
    };
  }

  async internalGenerate(params: {
    studentCourseId: string;
    forceBase: boolean;
    ownerUserId?: string;
    certText?: string;
  }): Promise<CourseCertificateSummary> {
    const started = Date.now();
    const existing = await this.prisma.courseCertificate.findUnique({
      where: { studentCourseId: params.studentCourseId },
    });
    if (existing && !params.forceBase) {
      this.logger.log(`internalGenerate course cert: existing id=${existing.id} duration_ms=${Date.now() - started}`);
      return this.toSummary(existing);
    }
    const imagePath = `certificates/course-${params.studentCourseId}-${Date.now()}.png`;
    const certText = params.certText ?? existing?.certText ?? 'Course certificate';
    const ownerUserId = params.ownerUserId ?? existing?.ownerUserId ?? null;
    if (existing && params.forceBase) {
      const updated = await this.prisma.courseCertificate.update({
        where: { id: existing.id },
        data: { imagePath, certText, ownerUserId: ownerUserId ?? undefined },
      });
      this.logger.log(`internalGenerate course cert: regenerated id=${updated.id} duration_ms=${Date.now() - started}`);
      return this.toSummary(updated);
    }
    const created = await this.prisma.courseCertificate.create({
      data: {
        studentCourseId: params.studentCourseId,
        imagePath,
        certText,
        ownerUserId,
      },
    });
    this.logger.log(`internalGenerate course cert: created id=${created.id} duration_ms=${Date.now() - started}`);
    return this.toSummary(created);
  }

  private toSummary(row: CourseCertificate): CourseCertificateSummary {
    return {
      id: row.id,
      studentCourseId: row.studentCourseId,
      imageUrl: buildPublicAssetUrl(row.imagePath),
      signedViewToken: this.viewTokens.signCourseCertificate(row.id),
      certText: row.certText ?? '',
      createdAt: row.createdAt.toISOString(),
    };
  }
}
