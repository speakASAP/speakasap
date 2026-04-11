import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePaginationQuery, buildPaginatedResponse } from '../shared/pagination';
import { formatQuestionCountRu } from '../shared/size-str';
import { buildLanguageTestLandingUrl } from '../shared/language-test-urls';
import { buildAllLevelStats, setsEqual } from './language-scoring';

@Injectable()
export class AdminLanguageTestsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLanguageTests(query: Record<string, unknown>) {
    const { page, limit, skip } = parsePaginationQuery(query);
    const where = {};
    const [total, rows] = await Promise.all([
      this.prisma.languageTest.count({ where }),
      this.prisma.languageTest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
        include: {
          _count: {
            select: { questions: { where: { isTrashed: false } } },
          },
        },
      }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      tag: r.tag,
      languageId: r.languageId,
      languageName: r.languageName,
      sizeStr: formatQuestionCountRu(r._count.questions),
      url: buildLanguageTestLandingUrl(r.id),
    }));
    return buildPaginatedResponse(items, total, page, limit);
  }

  async createLanguageTest(body: {
    name: string;
    tag: string;
    languageId: number;
    languageCode: string;
    languageName: string;
  }) {
    try {
      return await this.prisma.languageTest.create({ data: body });
    } catch {
      throw new BadRequestException('Duplicate tag/language or invalid payload');
    }
  }

  async getLanguageTest(testId: number) {
    const t = await this.prisma.languageTest.findUnique({ where: { id: testId } });
    if (!t) {
      throw new NotFoundException('Test not found');
    }
    return t;
  }

  async getLanguageTestCatalogItem(testId: number) {
    const t = await this.getLanguageTest(testId);
    const count = await this.prisma.languageQuestion.count({
      where: { testId, isTrashed: false },
    });
    return {
      id: t.id,
      name: t.name,
      tag: t.tag,
      languageId: t.languageId,
      languageCode: t.languageCode,
      languageName: t.languageName,
      sizeStr: formatQuestionCountRu(count),
      url: buildLanguageTestLandingUrl(t.id),
    };
  }

  async patchLanguageTest(
    testId: number,
    body: Partial<{
      name: string;
      tag: string;
      languageId: number;
      languageCode: string;
      languageName: string;
    }>,
  ) {
    await this.getLanguageTest(testId);
    try {
      return await this.prisma.languageTest.update({ where: { id: testId }, data: body });
    } catch {
      throw new BadRequestException('Update failed');
    }
  }

  async listQuestionsForTest(testId: number) {
    await this.getLanguageTest(testId);
    return this.prisma.languageQuestion.findMany({
      where: { testId, isTrashed: false },
      orderBy: [{ level: { difficult: 'asc' } }, { id: 'asc' }],
      include: { level: true },
    });
  }

  async createQuestion(testId: number, body: { text: string; levelId: number }) {
    await this.getLanguageTest(testId);
    const level = await this.prisma.level.findUnique({ where: { id: body.levelId } });
    if (!level) {
      throw new BadRequestException('Invalid level');
    }
    return this.prisma.languageQuestion.create({
      data: { testId, levelId: body.levelId, text: body.text },
      include: { level: true },
    });
  }

  async getQuestion(questionId: number) {
    const q = await this.prisma.languageQuestion.findUnique({
      where: { id: questionId },
      include: { level: true },
    });
    if (!q) {
      throw new NotFoundException('Question not found');
    }
    return q;
  }

  async patchQuestion(
    questionId: number,
    body: Partial<{ text: string; levelId: number; isTrashed: boolean }>,
  ) {
    await this.getQuestion(questionId);
    return this.prisma.languageQuestion.update({
      where: { id: questionId },
      data: body,
      include: { level: true },
    });
  }

  async deleteQuestion(questionId: number) {
    await this.patchQuestion(questionId, { isTrashed: true });
    return { ok: true };
  }

  async listAnswersForQuestion(questionId: number) {
    await this.getQuestion(questionId);
    return this.prisma.languageAnswer.findMany({
      where: { questionId, isTrashed: false },
      orderBy: { id: 'asc' },
    });
  }

  async createAnswer(questionId: number, body: { text: string; isCorrect: boolean }) {
    await this.getQuestion(questionId);
    return this.prisma.languageAnswer.create({
      data: { questionId, text: body.text, isCorrect: body.isCorrect },
    });
  }

  async getAnswer(answerId: number) {
    const a = await this.prisma.languageAnswer.findUnique({ where: { id: answerId } });
    if (!a) {
      throw new NotFoundException('Answer not found');
    }
    return a;
  }

  async patchAnswer(
    answerId: number,
    body: Partial<{ text: string; isCorrect: boolean; isTrashed: boolean }>,
  ) {
    await this.getAnswer(answerId);
    return this.prisma.languageAnswer.update({ where: { id: answerId }, data: body });
  }

  async deleteAnswer(answerId: number) {
    return this.patchAnswer(answerId, { isTrashed: true });
  }

  async listLevels() {
    return this.prisma.level.findMany({ orderBy: { difficult: 'asc' } });
  }

  async listAllUserTests(query: Record<string, unknown>) {
    const { page, limit, skip } = parsePaginationQuery(query);
    const [total, rows] = await Promise.all([
      this.prisma.languageUserTest.count(),
      this.prisma.languageUserTest.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          test: true,
        },
      }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      name: this.userTestDisplayName(r.test.languageName, r.test.name),
      createdAt: r.createdAt.toISOString(),
      finished: r.endedAt != null,
      languageCode: r.test.languageCode,
      tag: r.test.tag,
      languageId: r.test.languageId,
      user: { id: r.userId },
    }));
    return buildPaginatedResponse(items, total, page, limit);
  }

  async getUserTestAdminDetail(testId: number) {
    const ut = await this.prisma.languageUserTest.findUnique({
      where: { id: testId },
      include: {
        test: true,
        questions: {
          orderBy: { createdAt: 'asc' },
          include: {
            question: {
              include: {
                level: true,
                answers: { where: { isTrashed: false } },
              },
            },
            selections: { include: { answer: true } },
          },
        },
      },
    });
    if (!ut) {
      throw new NotFoundException('User test not found');
    }
    const rows = ut.questions.map((uq) => ({
      difficult: uq.question.level.difficult,
      isRight: this.isUserQuestionRight(uq),
    }));
    const stat = buildAllLevelStats(rows).map((s) => ({
      right: s.right,
      wrong: s.wrong,
      total: s.total,
      percent: s.percent,
      difficult: s.difficult,
    }));
    const questions = ut.questions.map((uq, idx) =>
      this.serializeUserQuestionAdmin(uq, idx + 1),
    );
    return {
      id: ut.id,
      name: this.userTestDisplayName(ut.test.languageName, ut.test.name),
      createdAt: ut.createdAt.toISOString(),
      finished: ut.endedAt != null,
      languageCode: ut.test.languageCode,
      tag: ut.test.tag,
      stat,
      questions,
      user: { id: ut.userId },
    };
  }

  private userTestDisplayName(languageName: string, testName: string): string {
    return `${testName} по ${languageName} языку`;
  }

  private isUserQuestionRight(uq: {
    question: { answers: { id: number; isCorrect: boolean }[] };
    selections: { answerId: number }[];
  }): boolean {
    const correct = new Set(
      uq.question.answers.filter((a) => a.isCorrect).map((a) => a.id),
    );
    const chosen = new Set(uq.selections.map((s) => s.answerId));
    return setsEqual(correct, chosen);
  }

  private serializeUserQuestionAdmin(
    uq: {
      id: number;
      createdAt: Date;
      isComplete: boolean;
      selections: { answerId: number }[];
      question: {
        text: string;
        answers: { id: number; text: string; isCorrect: boolean }[];
      };
    },
    order: number,
  ) {
    const activeTill = new Date(uq.createdAt.getTime() + 45_000);
    const now = Date.now();
    const secondsLeft = Math.max(
      0,
      Math.floor((activeTill.getTime() - now) / 1000),
    );
    const checked = new Set(uq.selections.map((s) => s.answerId));
    const answers = shuffle(
      uq.question.answers.map((a) => ({
        id: a.id,
        text: a.text,
        checked: checked.has(a.id),
      })),
    );
    return {
      id: uq.id,
      questionText: uq.question.text,
      activeTill: activeTill.toISOString(),
      active: activeTill.getTime() > now && !uq.isComplete,
      answers,
      complete: uq.isComplete,
      order,
      secondsLeft,
      isRight: this.isUserQuestionRight({
        question: { answers: uq.question.answers.map((a) => ({ id: a.id, isCorrect: a.isCorrect })) },
        selections: uq.selections,
      }),
    };
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
