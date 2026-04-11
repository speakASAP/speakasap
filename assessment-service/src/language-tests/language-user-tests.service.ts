import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildAllLevelStats,
  computeLevelStat,
  computeMaxScore,
  overallScoreFromStats,
  pickAssignedDifficult,
  setsEqual,
  LEVEL_THRESHOLD,
  QUESTION_ACTIVE_SECONDS,
  LevelStatRow,
} from './language-scoring';
import { signViewToken, verifyViewToken } from '../shared/view-token';
import { buildLanguageTestLandingUrl, buildResultPublicUrl } from '../shared/language-test-urls';

@Injectable()
export class LanguageUserTestsService {
  constructor(private readonly prisma: PrismaService) {}

  async startUserTest(userId: string, body: { languageCode: string; tag: string }) {
    const test = await this.prisma.languageTest.findUnique({
      where: {
        tag_languageCode: { tag: body.tag, languageCode: body.languageCode },
      },
    });
    if (!test) {
      throw new NotFoundException('Language test not found');
    }
    const ut = await this.prisma.languageUserTest.create({
      data: { userId, testId: test.id },
      include: { test: true, questions: true },
    });
    return this.buildUserTestState(ut.id, userId);
  }

  async getUserTestState(testId: number, userId: string) {
    const ut = await this.loadUserTestForStudent(testId, userId);
    return this.buildUserTestState(ut.id, userId);
  }

  async getCurrentQuestion(testId: number, userId: string) {
    const userTest = await this.loadUserTestForStudent(testId, userId);
    if (userTest.endedAt) {
      throw new NotFoundException('Test ended');
    }

    const levelsForTest = await this.prisma.level.findMany({
      where: { questions: { some: { testId: userTest.testId, isTrashed: false } } },
      orderBy: { difficult: 'asc' },
    });
    if (levelsForTest.length === 0) {
      throw new NotFoundException('No levels configured');
    }

    const existing = await this.prisma.languageUserTestQuestion.findMany({
      where: { userTestId: userTest.id },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        question: { include: { level: true, answers: { where: { isTrashed: false } } } },
        selections: true,
      },
    });

    if (existing.length > 0) {
      const last = existing[0];
      const activeTill = new Date(last.createdAt.getTime() + QUESTION_ACTIVE_SECONDS * 1000);
      const now = new Date();
      if (activeTill > now && !last.isComplete) {
        return this.serializeCurrentQuestion(last, userTest.id);
      }

      const difficult = last.question.level.difficult;
      const right = this.isUserQuestionRight(last);
      const nextLevel = await this.resolveNextLevel(userTest, difficult, right);
      const picked = await this.pickRandomQuestionOrEnd(userTest, nextLevel.id);
      if (!picked) {
        throw new NotFoundException('No more questions');
      }
      if (picked === 'ended') {
        throw new NotFoundException('Test ended');
      }
      return this.serializeCurrentQuestion(picked, userTest.id);
    }

    const firstLevel = levelsForTest[0];
    const picked = await this.pickRandomQuestionOrEnd(userTest, firstLevel.id);
    if (!picked || picked === 'ended') {
      throw new NotFoundException('No more questions');
    }
    return this.serializeCurrentQuestion(picked, userTest.id);
  }

  async patchUserQuestion(
    userQuestionId: number,
    userId: string,
    body: { check: number[] },
  ) {
    const uq = await this.prisma.languageUserTestQuestion.findUnique({
      where: { id: userQuestionId },
      include: {
        userTest: true,
        question: { include: { answers: { where: { isTrashed: false } } } },
        selections: true,
      },
    });
    if (!uq || uq.userTest.userId !== userId) {
      throw new ForbiddenException('Not allowed');
    }
    if (uq.userTest.endedAt) {
      throw new BadRequestException('Test already finished');
    }
    if (uq.isComplete) {
      throw new BadRequestException('Question already complete');
    }
    const activeTill = new Date(uq.createdAt.getTime() + QUESTION_ACTIVE_SECONDS * 1000);
    if (activeTill <= new Date()) {
      throw new BadRequestException('Answer timer expired');
    }
    const allowed = new Set(uq.question.answers.map((a) => a.id));
    const chosen = new Set(body.check || []);
    if (![...chosen].every((id) => allowed.has(id))) {
      throw new BadRequestException('Invalid answer ids');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.languageUserTestQuestionAnswer.deleteMany({
        where: { userTestQuestionId: uq.id },
      });
      for (const answerId of chosen) {
        await tx.languageUserTestQuestionAnswer.create({
          data: { userTestQuestionId: uq.id, answerId },
        });
      }
      await tx.languageUserTestQuestion.update({
        where: { id: uq.id },
        data: { isComplete: true },
      });
    });
    return { ok: true };
  }

  async getPublicResult(viewToken: string) {
    const secret = process.env.ASSESSMENT_VIEW_TOKEN_SECRET || '';
    const userTestId = verifyViewToken(viewToken, secret);
    if (userTestId == null) {
      throw new NotFoundException('Invalid result token');
    }
    const ut = await this.prisma.languageUserTest.findUnique({
      where: { id: userTestId },
      include: { test: true },
    });
    if (!ut?.endedAt) {
      throw new NotFoundException('Result not available');
    }
    await this.ensureResultRow(userTestId);
    const full = await this.prisma.languageUserTestResult.findUnique({
      where: { userTestId },
      include: {
        userTest: { include: { test: true } },
        level: true,
      },
    });
    if (!full) {
      throw new NotFoundException('Result not found');
    }
    const maxScore = await this.computeTestMaxScore(full.userTest.testId);
    const sliderValue =
      maxScore > 0 ? Math.round((full.score / maxScore) * 100) : 0;
    const position = await this.computePosition(full.score);
    const avgSliderValue = await this.computeAvgSliderExcluding(userTestId, maxScore);
    const recs = await this.prisma.levelRecommendation.findMany({
      where: { levelId: full.levelId, languageId: full.userTest.test.languageId },
    });
    return {
      score: full.score,
      position,
      sliderValue,
      avgSliderValue,
      recommendations: recs.map((r) => ({
        title: r.title,
        description: r.description,
        link: r.link,
      })),
      testUrl: buildLanguageTestLandingUrl(full.userTest.testId),
    };
  }

  private async loadUserTestForStudent(testId: number, userId: string) {
    const ut = await this.prisma.languageUserTest.findUnique({
      where: { id: testId },
      include: { test: true },
    });
    if (!ut) {
      throw new NotFoundException('User test not found');
    }
    if (ut.userId !== userId) {
      throw new ForbiddenException('Not allowed');
    }
    return ut;
  }

  private async buildUserTestState(id: number, userId: string) {
    const ut = await this.prisma.languageUserTest.findUnique({
      where: { id },
      include: {
        test: true,
        questions: {
          orderBy: { createdAt: 'asc' },
          include: {
            question: { include: { answers: { where: { isTrashed: false } } } },
            selections: { include: { answer: true } },
          },
        },
        result: { include: { level: true } },
      },
    });
    if (!ut || ut.userId !== userId) {
      throw new NotFoundException('User test not found');
    }
    const secret = process.env.ASSESSMENT_VIEW_TOKEN_SECRET || '';
    let resultUrl: string | null = null;
    let result: { score: number; levelId: number; levelName: string } | null = null;
    if (ut.endedAt) {
      await this.ensureResultRow(ut.id);
      const r = await this.prisma.languageUserTestResult.findUnique({
        where: { userTestId: ut.id },
        include: { level: true },
      });
      if (r) {
        result = { score: r.score, levelId: r.levelId, levelName: r.level.name };
        resultUrl = buildResultPublicUrl(signViewToken(ut.id, secret));
      }
    }
    const questionsDetailed = ut.questions.map((q) => {
      const base = {
        id: q.id,
        questionText: q.question.text,
        complete: q.isComplete,
      };
      if (!q.isComplete) {
        return base;
      }
      return {
        ...base,
        isRight: this.isUserQuestionRight(q),
      };
    });
    return {
      id: ut.id,
      name: `${ut.test.name} по ${ut.test.languageName} языку`,
      createdAt: ut.createdAt.toISOString(),
      finished: ut.endedAt != null,
      result,
      resultUrl,
      testUrl: buildLanguageTestLandingUrl(ut.testId),
      questions: questionsDetailed,
    };
  }

  private async serializeCurrentQuestion(
    uq: {
      id: number;
      createdAt: Date;
      isComplete: boolean;
      question: { text: string; answers: { id: number; text: string; isCorrect: boolean }[] };
      selections: { answerId: number }[];
    },
    userTestId: number,
  ) {
    const order =
      (await this.prisma.languageUserTestQuestion.count({
        where: { userTestId, createdAt: { lt: uq.createdAt } },
      })) + 1;
    const activeTill = new Date(uq.createdAt.getTime() + QUESTION_ACTIVE_SECONDS * 1000);
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
    const complete = uq.isComplete;
    return {
      id: uq.id,
      questionText: uq.question.text,
      answers,
      activeTill: activeTill.toISOString(),
      active: activeTill.getTime() > now && !complete,
      complete,
      order,
      secondsLeft,
    };
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

  private async resolveNextLevel(
    userTest: { id: number; testId: number },
    difficult: number,
    right: boolean,
  ) {
    const testId = userTest.testId;
    if (!right) {
      return this.prevLevel(testId, difficult);
    }
    const rows = await this.levelStatRows(userTest.id);
    const stat = computeLevelStat(rows, difficult);
    if (stat.percent < LEVEL_THRESHOLD) {
      return this.currentLevel(testId, difficult);
    }
    return this.nextLevel(testId, difficult);
  }

  private async prevLevel(testId: number, difficult: number) {
    const row = await this.prisma.level.findFirst({
      where: {
        difficult: { lt: difficult },
        questions: { some: { testId, isTrashed: false } },
      },
      orderBy: { difficult: 'desc' },
    });
    if (!row) {
      return this.currentLevel(testId, difficult);
    }
    return row;
  }

  private async nextLevel(testId: number, difficult: number) {
    const row = await this.prisma.level.findFirst({
      where: {
        difficult: { gt: difficult },
        questions: { some: { testId, isTrashed: false } },
      },
      orderBy: { difficult: 'asc' },
    });
    if (!row) {
      return this.currentLevel(testId, difficult);
    }
    return row;
  }

  private async currentLevel(testId: number, difficult: number) {
    const row = await this.prisma.level.findFirst({
      where: { difficult, questions: { some: { testId, isTrashed: false } } },
    });
    if (!row) {
      throw new NotFoundException('Level configuration missing');
    }
    return row;
  }

  private async levelStatRows(userTestId: number): Promise<LevelStatRow[]> {
    const uqs = await this.prisma.languageUserTestQuestion.findMany({
      where: { userTestId, isComplete: true },
      include: {
        question: { include: { level: true, answers: { where: { isTrashed: false } } } },
        selections: true,
      },
    });
    return uqs.map((uq) => ({
      difficult: uq.question.level.difficult,
      isRight: this.isUserQuestionRight(uq),
    }));
  }

  /** Returns new UQ row, 'ended', or null if cannot pick */
  private async pickRandomQuestionOrEnd(
    userTest: { id: number; testId: number },
    levelId: number,
  ) {
    const complete = await this.prisma.languageUserTestQuestion.findMany({
      where: { userTestId: userTest.id, question: { levelId } },
      select: { questionId: true },
    });
    const doneIds = new Set(complete.map((c) => c.questionId));
    const pool = await this.prisma.languageQuestion.findMany({
      where: { testId: userTest.testId, levelId, isTrashed: false },
      select: { id: true },
    });
    const possible = pool.map((p) => p.id).filter((id) => !doneIds.has(id));
    if (possible.length === 0) {
      await this.prisma.languageUserTest.update({
        where: { id: userTest.id },
        data: { endedAt: new Date() },
      });
      return 'ended' as const;
    }
    const nextQuestionId = possible[Math.floor(Math.random() * possible.length)];
    const created = await this.prisma.languageUserTestQuestion.create({
      data: { userTestId: userTest.id, questionId: nextQuestionId },
      include: {
        question: { include: { level: true, answers: { where: { isTrashed: false } } } },
        selections: true,
      },
    });
    return created;
  }

  private async ensureResultRow(userTestId: number) {
    const ut = await this.prisma.languageUserTest.findUnique({
      where: { id: userTestId },
      include: {
        questions: {
          where: { isComplete: true },
          include: {
            question: { include: { level: true, answers: { where: { isTrashed: false } } } },
            selections: true,
          },
        },
        test: true,
      },
    });
    if (!ut?.endedAt) {
      return null;
    }
    const rows: LevelStatRow[] = ut.questions.map((uq) => ({
      difficult: uq.question.level.difficult,
      isRight: this.isUserQuestionRight(uq),
    }));
    const stats = buildAllLevelStats(rows);
    const score = overallScoreFromStats(stats);
    const difficult =
      stats.length > 0
        ? pickAssignedDifficult(stats)
        : (
            await this.prisma.level.findFirst({
              where: {
                questions: { some: { testId: ut.testId, isTrashed: false } },
              },
              orderBy: { difficult: 'asc' },
            })
          )?.difficult ?? 1;
    const level = await this.prisma.level.findFirst({
      where: { difficult, questions: { some: { testId: ut.testId, isTrashed: false } } },
    });
    if (!level) {
      return null;
    }
    const existing = await this.prisma.languageUserTestResult.findUnique({
      where: { userTestId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.languageUserTestResult.create({
      data: { userTestId, score: Math.round(Number(score)), levelId: level.id },
    });
  }

  private async computeTestMaxScore(testId: number): Promise<number> {
    const qs = await this.prisma.languageQuestion.findMany({
      where: { testId, isTrashed: false },
      include: { level: true },
    });
    return computeMaxScore(qs.map((q) => q.level.difficult));
  }

  private async computePosition(score: number): Promise<number> {
    const all = await this.prisma.languageUserTestResult.findMany({
      select: { score: true },
    });
    if (all.length === 0) {
      return 0;
    }
    const lower = all.filter((r) => r.score < score).length;
    return Math.round((lower / all.length) * 100);
  }

  /** Legacy: average raw score of all other results / this test's max_score. */
  private async computeAvgSliderExcluding(
    excludeUserTestId: number,
    maxScore: number,
  ): Promise<number> {
    const others = await this.prisma.languageUserTestResult.findMany({
      where: { userTestId: { not: excludeUserTestId } },
      select: { score: true },
    });
    if (others.length === 0 || maxScore === 0) {
      return 0;
    }
    const sum = others.reduce((a, b) => a + b.score, 0);
    const avg = sum / others.length;
    return Math.round((avg / maxScore) * 100);
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
