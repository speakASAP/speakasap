import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MasteryDelta, masteredAtFor, nextStreak } from './mastery';

/**
 * Persistence for `StudentWordMastery`.
 *
 * Deliberately separate from the arithmetic in `mastery.ts`: the streak rules are worth
 * testing without a database, and the database work is worth testing without restating
 * the rules.
 */
@Injectable()
export class MasteryRepository {
  private readonly logger = new Logger(MasteryRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applies one assignment's outcomes to the student's word records.
   *
   * Read-then-upsert rather than a raw increment: `masteredAt` depends on the streak
   * value AFTER the change, and a reset has to clear it. Assignments complete one at a
   * time per student, so the read-modify-write window is not contended in practice.
   */
  async applyDeltas(
    studentId: number,
    languageCode: string,
    deltas: MasteryDelta[],
    now: Date,
  ): Promise<void> {
    if (deltas.length === 0) {
      return;
    }

    const existing: any[] = await (this.prisma as any).studentWordMastery.findMany({
      where: {
        studentId,
        languageCode,
        normalizedAnswer: { in: deltas.map((d) => d.normalizedAnswer) },
      },
    });

    const byAnswer = new Map<string, any>();
    for (const row of existing) {
      byAnswer.set(row.normalizedAnswer, row);
    }

    for (const delta of deltas) {
      const row = byAnswer.get(delta.normalizedAnswer);
      const currentStreak = typeof row?.cleanStreak === 'number' ? row.cleanStreak : 0;
      const currentMistakes = typeof row?.totalMistakes === 'number' ? row.totalMistakes : 0;

      const streak = nextStreak(currentStreak, delta.clean);
      const masteredAt = masteredAtFor(streak, now);

      await (this.prisma as any).studentWordMastery.upsert({
        where: {
          studentId_languageCode_normalizedAnswer: {
            studentId,
            languageCode,
            normalizedAnswer: delta.normalizedAnswer,
          },
        },
        update: {
          displayAnswer: delta.displayAnswer,
          cleanStreak: streak,
          totalMistakes: currentMistakes + delta.mistakes,
          lastSeenAt: now,
          masteredAt,
        },
        create: {
          uuid: randomUUID(),
          studentId,
          languageCode,
          normalizedAnswer: delta.normalizedAnswer,
          displayAnswer: delta.displayAnswer,
          cleanStreak: streak,
          totalMistakes: delta.mistakes,
          lastSeenAt: now,
          masteredAt,
        },
      });
    }

    const mastered = deltas.filter((d) => d.clean).length;
    this.logger.log(
      `Mastery updated: student=${studentId} lang=${languageCode} words=${deltas.length} clean=${mastered}`,
    );
  }

  /** Which of these answers the student has already retired. */
  async masteredAnswers(
    studentId: number,
    languageCode: string,
    normalizedAnswers: string[],
  ): Promise<Set<string>> {
    if (normalizedAnswers.length === 0) {
      return new Set();
    }

    const rows: any[] = await (this.prisma as any).studentWordMastery.findMany({
      where: { studentId, languageCode, normalizedAnswer: { in: normalizedAnswers } },
    });

    return new Set(
      rows.filter((row) => row.masteredAt !== null && row.masteredAt !== undefined)
        .map((row) => row.normalizedAnswer as string),
    );
  }
}
