import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EducationCertificate } from '@prisma/client';
import { PrismaService } from '../shared/prisma.service';
import { buildPaginatedResponse, getPaginationParams, PaginatedResponse } from '../shared/pagination';
import { buildPublicAssetUrl } from '../shared/public-asset-url';
import { hasTeacherAccess } from '../auth/roles';
import type { JwtUser } from '../auth/jwt-user';
import { ViewTokenService } from './view-token.service';

export type EducationCertificateSummary = {
  id: number;
  studentCourseId: string;
  studentId: number;
  imageUrl: string;
  signedViewToken: string;
  certText: string;
  createdAt: string;
};

@Injectable()
export class EducationCertificatesService {
  private readonly logger = new Logger(EducationCertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly viewTokens: ViewTokenService,
  ) {}

  async listForUser(userId: string, page?: string, limit?: string): Promise<PaginatedResponse<EducationCertificateSummary>> {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const where = { ownerUserId: userId };
    const [rows, total] = await Promise.all([
      this.prisma.educationCertificate.findMany({ where, orderBy: { id: 'desc' }, skip, take: l }),
      this.prisma.educationCertificate.count({ where }),
    ]);
    return buildPaginatedResponse(rows.map((r) => this.toSummary(r)), total, p, l);
  }

  async getByIdForUser(id: number, user: JwtUser): Promise<EducationCertificateSummary> {
    const row = await this.prisma.educationCertificate.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Certificate not found');
    }
    if (row.ownerUserId === user.sub) {
      return this.toSummary(row);
    }
    if (hasTeacherAccess(user.roles)) {
      return this.toSummary(row);
    }
    throw new ForbiddenException('Not certificate owner');
  }

  async getPublicByToken(token: string): Promise<{ imageUrl: string; certText: string }> {
    const payload = this.viewTokens.verify(token);
    if (!payload || payload.k !== 'ec') {
      throw new NotFoundException('Invalid or expired link');
    }
    const row = await this.prisma.educationCertificate.findUnique({ where: { id: payload.id } });
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
    studentIds?: number[];
    allFinished?: boolean;
    forceBase: boolean;
    sendNotification: boolean;
    ownerUserId?: string;
    certText?: string;
  }): Promise<EducationCertificateSummary[]> {
    const started = Date.now();
    if (params.allFinished) {
      throw new BadRequestException('allFinished requires education-service integration (not configured here)');
    }
    const ids = params.studentIds ?? [];
    if (!ids.length) {
      throw new BadRequestException('studentIds is required unless allFinished is supported');
    }
    const results: EducationCertificate[] = [];
    for (const studentId of ids) {
      const row = await this.upsertOne({
        studentCourseId: params.studentCourseId,
        studentId,
        forceBase: params.forceBase,
        ownerUserId: params.ownerUserId,
        certText: params.certText,
      });
      results.push(row);
    }
    if (params.sendNotification) {
      this.logger.warn('sendNotification=true: notification dispatch is owned by notifications-microservice (not invoked here)');
    }
    this.logger.log(`internalGenerate education certs: count=${results.length} duration_ms=${Date.now() - started}`);
    return results.map((r) => this.toSummary(r));
  }

  private async upsertOne(params: {
    studentCourseId: string;
    studentId: number;
    forceBase: boolean;
    ownerUserId?: string;
    certText?: string;
  }): Promise<EducationCertificate> {
    const key = { studentCourseId_studentId: { studentCourseId: params.studentCourseId, studentId: params.studentId } };
    const existing = await this.prisma.educationCertificate.findUnique({ where: key });
    if (existing && !params.forceBase) {
      return existing;
    }
    const imagePath = `certificates/education-${params.studentCourseId}-${params.studentId}-${Date.now()}.png`;
    const certText = params.certText ?? existing?.certText ?? 'Education certificate';
    const ownerUserId = params.ownerUserId ?? existing?.ownerUserId ?? null;
    if (existing && params.forceBase) {
      return this.prisma.educationCertificate.update({
        where: { id: existing.id },
        data: { imagePath, certText, ownerUserId: ownerUserId ?? undefined },
      });
    }
    return this.prisma.educationCertificate.create({
      data: {
        studentCourseId: params.studentCourseId,
        studentId: params.studentId,
        imagePath,
        certText,
        ownerUserId,
      },
    });
  }

  private toSummary(row: EducationCertificate): EducationCertificateSummary {
    return {
      id: row.id,
      studentCourseId: row.studentCourseId,
      studentId: row.studentId,
      imageUrl: buildPublicAssetUrl(row.imagePath),
      signedViewToken: this.viewTokens.signEducationCertificate(row.id),
      certText: row.certText ?? '',
      createdAt: row.createdAt.toISOString(),
    };
  }
}
