import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { buildPaginatedResponse, getPaginationParams, PaginatedResponse } from '../shared/pagination';
import { hasManagerAccess } from '../auth/roles';
import type { JwtUser } from '../auth/jwt-user';

@Injectable()
export class QuestionnairesService {
  private readonly logger = new Logger(QuestionnairesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(page?: string, limit?: string): Promise<PaginatedResponse<{ id: number; title: string }>> {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const [rows, total] = await Promise.all([
      this.prisma.questionnaire.findMany({ orderBy: { id: 'asc' }, skip, take: l, select: { id: true, title: true } }),
      this.prisma.questionnaire.count(),
    ]);
    return buildPaginatedResponse(rows, total, p, l);
  }

  async getCatalogItem(id: number): Promise<{
    id: number;
    title: string;
    questions: { id: number; text: string; header: string | null }[];
  }> {
    if (!Number.isFinite(id) || id <= 0) {
      throw new NotFoundException('Questionnaire not found');
    }
    const row = await this.prisma.questionnaire.findUnique({
      where: { id },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) {
      throw new NotFoundException('Questionnaire not found');
    }
    return {
      id: row.id,
      title: row.title,
      questions: row.questions.map((q) => ({ id: q.id, text: q.text, header: q.header })),
    };
  }

  async listUserQuestionnaires(
    user: JwtUser,
    status: 'incomplete' | 'completed',
    page?: string,
    limit?: string,
    filterUserId?: string,
  ): Promise<
    PaginatedResponse<{
      id: number;
      questionnaire: { id: number; title: string };
      userId: string;
      createdAt: string;
      finishedAt: string | null;
    }>
  > {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const targetUserId =
      status === 'completed' && filterUserId && hasManagerAccess(user.roles) ? filterUserId : user.sub;
    const where =
      status === 'completed'
        ? { userId: targetUserId, finishedAt: { not: null } }
        : { userId: targetUserId, finishedAt: null };
    const [rows, total] = await Promise.all([
      this.prisma.userQuestionnaire.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: l,
        include: { questionnaire: { select: { id: true, title: true } } },
      }),
      this.prisma.userQuestionnaire.count({ where }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      questionnaire: r.questionnaire,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    }));
    return buildPaginatedResponse(items, total, p, l);
  }

  async getUserQuestionnaireDetail(id: number, user: JwtUser): Promise<{
    id: number;
    questionnaire: { id: number; title: string; questions: { id: number; text: string; header: string | null }[] };
    userId: string;
    createdAt: string;
    finishedAt: string | null;
    answers: { questionPk: number; questionText: string; questionHeader: string | null; text: string }[];
    answer: Record<string, string>;
  }> {
    const row = await this.prisma.userQuestionnaire.findUnique({
      where: { id },
      include: {
        questionnaire: { include: { questions: { orderBy: { sortOrder: 'asc' } } } },
        answers: { include: { question: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('User questionnaire not found');
    }
    if (row.userId !== user.sub) {
      throw new NotFoundException('User questionnaire not found');
    }
    if (row.finishedAt) {
      throw new NotFoundException('User questionnaire not found');
    }
    const answer: Record<string, string> = {};
    const answers = row.answers.map((a) => {
      answer[String(a.questionId)] = a.text;
      return {
        questionPk: a.questionId,
        questionText: a.question.text,
        questionHeader: a.question.header,
        text: a.text,
      };
    });
    return {
      id: row.id,
      questionnaire: {
        id: row.questionnaire.id,
        title: row.questionnaire.title,
        questions: row.questionnaire.questions.map((q) => ({
          id: q.id,
          text: q.text,
          header: q.header,
        })),
      },
      userId: row.userId,
      createdAt: row.createdAt.toISOString(),
      finishedAt: null,
      answers,
      answer,
    };
  }

  async submitUserQuestionnaire(id: number, user: JwtUser, body: { answer: Record<string, string> }): Promise<void> {
    const row = await this.prisma.userQuestionnaire.findUnique({
      where: { id },
      include: { questionnaire: { include: { questions: true } } },
    });
    if (!row || row.userId !== user.sub) {
      throw new NotFoundException('User questionnaire not found');
    }
    if (row.finishedAt) {
      throw new BadRequestException('Questionnaire already finished');
    }
    const incoming = body.answer ?? {};
    const questionIds = row.questionnaire.questions.map((q) => q.id);
    for (const qid of questionIds) {
      const text = incoming[String(qid)];
      if (typeof text !== 'string' || !text.trim()) {
        throw new BadRequestException('All questions must be answered');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      for (const qid of questionIds) {
        const text = incoming[String(qid)]!.trim();
        await tx.userQuestionnaireAnswer.upsert({
          where: {
            userQuestionnaireId_questionId: { userQuestionnaireId: id, questionId: qid },
          },
          create: { userQuestionnaireId: id, questionId: qid, text },
          update: { text },
        });
      }
      const allAnswered = await tx.userQuestionnaireAnswer.count({
        where: { userQuestionnaireId: id },
      });
      if (allAnswered === questionIds.length) {
        await tx.userQuestionnaire.update({
          where: { id },
          data: { finishedAt: new Date() },
        });
      }
    });
    this.logger.log(`UserQuestionnaire ${id} submit processed`);
  }

  async listManagerCompleted(page?: string, limit?: string): Promise<
    PaginatedResponse<{
      id: number;
      questionnaire: { id: number; title: string };
      userId: string;
      createdAt: string;
      finishedAt: string | null;
    }>
  > {
    const { page: p, limit: l, skip } = getPaginationParams(page, limit);
    const where = { finishedAt: { not: null } };
    const [rows, total] = await Promise.all([
      this.prisma.userQuestionnaire.findMany({
        where,
        orderBy: { finishedAt: 'desc' },
        skip,
        take: l,
        include: { questionnaire: { select: { id: true, title: true } } },
      }),
      this.prisma.userQuestionnaire.count({ where }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      questionnaire: r.questionnaire,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    }));
    return buildPaginatedResponse(items, total, p, l);
  }

  async getManagerCompletedDetail(id: number): Promise<{
    id: number;
    questionnaire: { id: number; title: string };
    userId: string;
    createdAt: string;
    finishedAt: string | null;
    answers: { questionPk: number; questionText: string; questionHeader: string | null; text: string }[];
  }> {
    const row = await this.prisma.userQuestionnaire.findUnique({
      where: { id },
      include: {
        questionnaire: { select: { id: true, title: true } },
        answers: { include: { question: true } },
      },
    });
    if (!row || !row.finishedAt) {
      throw new NotFoundException('Completed questionnaire not found');
    }
    return {
      id: row.id,
      questionnaire: row.questionnaire,
      userId: row.userId,
      createdAt: row.createdAt.toISOString(),
      finishedAt: row.finishedAt.toISOString(),
      answers: row.answers.map((a) => ({
        questionPk: a.questionId,
        questionText: a.question.text,
        questionHeader: a.question.header,
        text: a.text,
      })),
    };
  }

}
