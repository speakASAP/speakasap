import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestInstance } from '@prisma/client';
import { PrismaService } from '../shared/prisma.service';
import { hasTeacherAccess } from '../auth/roles';
import type { JwtUser } from '../auth/jwt-user';

export type QuestState = {
  questId: string;
  code: string;
  identifier: Record<string, unknown>;
  questions: Record<string, unknown>;
  answers: Record<string, unknown>;
  isCompleted: boolean;
  startOpened: boolean;
};

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getQuest(questId: string, user: JwtUser): Promise<QuestState> {
    const row = await this.prisma.questInstance.findUnique({ where: { id: questId } });
    if (!row) {
      throw new NotFoundException('Quest not found');
    }
    if (row.userId !== user.sub && !hasTeacherAccess(user.roles)) {
      throw new NotFoundException('Quest not found');
    }
    return this.toState(row);
  }

  async patchQuest(questId: string, user: JwtUser, body: { answers: Record<string, string> }): Promise<QuestState> {
    const row = await this.prisma.questInstance.findUnique({ where: { id: questId } });
    if (!row) {
      throw new NotFoundException('Quest not found');
    }
    if (row.userId !== user.sub) {
      throw new ForbiddenException('Only quest owner can submit answers');
    }
    if (row.completedAt) {
      throw new ForbiddenException('Quest already completed');
    }
    const requiredKeys = this.extractRequiredQuestionKeys(row.questions);
    const provided = body.answers ?? {};
    const keysOk = new Set(requiredKeys);
    const providedSet = new Set(Object.keys(provided));
    if (keysOk.size !== providedSet.size || ![...keysOk].every((k) => providedSet.has(k))) {
      throw new BadRequestException('Answers must include exactly all required question keys');
    }
    const mergedAnswers = { ...(row.answers as Record<string, unknown>), ...provided };
    const updated = await this.prisma.questInstance.update({
      where: { id: questId },
      data: {
        answers: mergedAnswers as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    this.logger.log(`Quest ${questId} marked completed`);
    return this.toState(updated);
  }

  async getTeacherQuestState(params: {
    studentCourseUuid: string;
    studentId: number;
    postfix: string;
  }): Promise<QuestState | Record<string, never>> {
    const postfix = params.postfix.toLowerCase();
    if (postfix !== 'start' && postfix !== 'finish') {
      return {};
    }
    const suffix = `-${postfix.toUpperCase()}`;
    const rows = await this.prisma.$queryRaw<QuestInstance[]>`
      SELECT *
      FROM "QuestInstance"
      WHERE "code" LIKE ${'%' + suffix}
        AND (
          "studentCourseRef" = ${params.studentCourseUuid}
          OR (identifier->>'student_course') = ${params.studentCourseUuid}
        )
        AND ("studentPk" IS NULL OR "studentPk" = ${params.studentId})
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;
    const row = rows[0];
    if (!row) {
      return {};
    }
    return this.toState(row);
  }

  private extractRequiredQuestionKeys(questions: Prisma.JsonValue): string[] {
    const q = questions as { pages?: { elements?: { name?: string }[] }[] };
    const elements = q.pages?.[0]?.elements;
    if (!elements?.length) {
      throw new BadRequestException('Quest has no questions');
    }
    return elements.map((e) => e.name).filter((n): n is string => typeof n === 'string' && n.length > 0);
  }

  private toState(row: QuestInstance): QuestState {
    const identifier = (row.identifier ?? {}) as Record<string, unknown>;
    const questions = (row.questions ?? {}) as Record<string, unknown>;
    const answers = (row.answers ?? {}) as Record<string, unknown>;
    return {
      questId: row.id,
      code: row.code,
      identifier,
      questions,
      answers,
      isCompleted: row.completedAt != null,
      startOpened: this.computeStartOpened(identifier),
    };
  }

  private computeStartOpened(identifier: Record<string, unknown>): boolean {
    if (!identifier['student_course']) {
      return false;
    }
    return false;
  }
}
