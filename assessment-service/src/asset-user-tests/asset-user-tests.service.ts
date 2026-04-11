import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { parsePaginationQuery, buildPaginatedResponse } from '../shared/pagination';
import { processQuestions, validateQuestions, SurveyJson } from './process-questions';

const QUESTIONS_NUM = 10;
const ANSWERS_NUM = 4;
const MAX_TEST_ATTEMPTS = 5;

@Injectable()
export class AssetUserTestsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(
    userId: string,
    query: Record<string, unknown>,
    isManager: boolean,
  ) {
    const targetUserId = this.resolveListUserId(userId, query, isManager);
    const { page, limit, skip } = parsePaginationQuery(query);
    const where = { userId: targetUserId };
    const [total, rows] = await Promise.all([
      this.prisma.assetUserTest.count({ where }),
      this.prisma.assetUserTest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      title: (r.questions as SurveyJson)?.title ?? '',
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
      success: Boolean(r.completedAt) && r.errors.length === 0,
    }));
    return buildPaginatedResponse(items, total, page, limit);
  }

  async create(userId: string, body: { asset: string; dueDate?: string }) {
    const attemptsLeft = await this.computeAttemptsLeft(userId, body.asset);
    if (attemptsLeft <= 0) {
      throw new BadRequestException('Maximum failed attempts reached for this asset');
    }
    const raw = await this.loadAssetJson(body.asset);
    const questions = processQuestions(raw, QUESTIONS_NUM, ANSWERS_NUM) as object;
    const id = randomUUID();
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.dueDate && Number.isNaN(dueDate!.getTime())) {
      throw new BadRequestException('Invalid dueDate');
    }
    const row = await this.prisma.assetUserTest.create({
      data: {
        id,
        userId,
        asset: body.asset,
        questions,
        dueDate,
      },
    });
    return {
      completedAt: null,
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      title: (row.questions as SurveyJson)?.title ?? '',
      dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
      success: false,
    };
  }

  async getDetail(userId: string, testId: string) {
    const row = await this.prisma.assetUserTest.findUnique({ where: { id: testId } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Test not found');
    }
    const attemptsLeft = await this.computeAttemptsLeft(userId, row.asset);
    return {
      id: row.id,
      questions: row.questions,
      answers: row.answers,
      createdAt: row.createdAt.toISOString(),
      dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
      completedAt: row.completedAt?.toISOString() ?? null,
      success: row.completedAt != null && row.errors.length === 0,
      isCompleted: row.completedAt != null,
      errors: row.errors,
      attemptsLeft,
    };
  }

  async patchAnswers(userId: string, testId: string, body: { answers: Record<string, string[]> }) {
    const row = await this.prisma.assetUserTest.findUnique({ where: { id: testId } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Test not found');
    }
    if (row.completedAt) {
      throw new BadRequestException('Test already completed');
    }
    const data = row.questions as SurveyJson;
    const errors = validateQuestions(data, body.answers || {});
    const completedAt = new Date();
    await this.prisma.assetUserTest.update({
      where: { id: testId },
      data: {
        answers: body.answers as object,
        completedAt,
        errors,
      },
    });
    return { ok: true, errors, completedAt: completedAt.toISOString() };
  }

  private resolveListUserId(
    requesterId: string,
    query: Record<string, unknown>,
    isManager: boolean,
  ): string {
    const raw = query.userId ?? query.user;
    if (raw == null || raw === '') {
      return requesterId;
    }
    if (!isManager) {
      throw new ForbiddenException('userId filter requires manager role');
    }
    return String(raw);
  }

  private async loadAssetJson(asset: string): Promise<SurveyJson> {
    if (!/^[a-zA-Z0-9_-]+$/.test(asset)) {
      throw new BadRequestException('Invalid asset name');
    }
    const dir = process.env.USER_TEST_ASSETS_DIR || '';
    const path = join(dir, `${asset}.json`);
    const text = await readFile(path, 'utf8');
    return JSON.parse(text) as SurveyJson;
  }

  private async computeAttemptsLeft(userId: string, asset: string): Promise<number> {
    const failed = await this.prisma.assetUserTest.count({
      where: {
        userId,
        asset,
        completedAt: { not: null },
        NOT: { errors: { equals: [] } },
      },
    });
    return Math.max(0, MAX_TEST_ATTEMPTS - failed);
  }
}
