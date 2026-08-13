import { gradingOptionsFor, normalizeAnswer } from '../grading';
import { AnalysisAttemptInput, AnalysisItemInput } from './contracts';

/**
 * Consecutive clean appearances that retire a word from remedial work.
 *
 * Three, deliberately: one is luck and two is a coincidence. A word that survives three
 * separate first-try-correct appearances is known, and continuing to drill it spends the
 * student's attention on something already learned.
 */
export const MASTERY_STREAK_TARGET = 3;

export interface MasteryDelta {
  normalizedAnswer: string;
  /** The surface form last seen, for the teacher's weak-word list. */
  displayAnswer: string;
  /** True only when EVERY appearance of the word in this assignment was clean. */
  clean: boolean;
  /** Wrong typed attempts across every appearance; a bare reveal counts as one. */
  mistakes: number;
}

/**
 * Per-word outcomes for one completed assignment.
 *
 * A **clean appearance** is the blank's first attempt being correct with the blank never
 * revealed. A word solved on the fourth try was not known — counting it clean would
 * advance a streak on a word the student guessed their way through.
 *
 * When a word appears in several sentences, one dirty appearance spoils the whole word:
 * the streak describes the word, not the sentence.
 *
 * Keys come from `normalizeAnswer` with this language's grading options — the SAME
 * normalization the grader uses. A second normalizer here would silently split one
 * student's record in two.
 */
export function computeMasteryDeltas(
  items: AnalysisItemInput[],
  attempts: AnalysisAttemptInput[],
  languageCode: string,
): MasteryDelta[] {
  const options = gradingOptionsFor(languageCode);

  const byItem = new Map<string, AnalysisItemInput>();
  for (const item of items) {
    byItem.set(item.uuid, item);
  }

  const grouped = new Map<string, AnalysisAttemptInput[]>();
  for (const attempt of attempts) {
    const key = `${attempt.itemUuid}:${attempt.blankIndex}`;
    const list = grouped.get(key);
    if (list) {
      list.push(attempt);
    } else {
      grouped.set(key, [attempt]);
    }
  }

  const deltas = new Map<string, MasteryDelta>();

  for (const [key, tries] of grouped) {
    const [itemUuid] = key.split(':');
    const item = byItem.get(itemUuid);
    if (!item) {
      continue;
    }

    const blankIndex = Number(key.slice(itemUuid.length + 1));
    const answer = answerFor(item.blanks, blankIndex);
    if (!answer) {
      continue;
    }

    const ordered = [...tries].sort((a, b) => a.attemptNo - b.attemptNo);
    const revealed = ordered.some((t) => t.revealed);
    const wrongCount = ordered.filter((t) => !t.isCorrect && !t.revealed).length;
    const first = ordered[0];
    const clean = !revealed && Boolean(first?.isCorrect);
    const mistakes = wrongCount > 0 ? wrongCount : revealed ? 1 : 0;

    const normalized = normalizeAnswer(answer, options);
    if (!normalized) {
      continue;
    }

    const existing = deltas.get(normalized);
    if (existing) {
      existing.clean = existing.clean && clean;
      existing.mistakes += mistakes;
    } else {
      deltas.set(normalized, {
        normalizedAnswer: normalized,
        displayAnswer: answer,
        clean,
        mistakes,
      });
    }
  }

  return [...deltas.values()];
}

/** The streak after one appearance. Clean advances it; anything else resets it. */
export function nextStreak(current: number, clean: boolean): number {
  return clean ? current + 1 : 0;
}

/** When a streak reaches the target the word is mastered; below it, it is not. */
export function masteredAtFor(streak: number, now: Date): Date | null {
  return streak >= MASTERY_STREAK_TARGET ? now : null;
}

function answerFor(blanks: unknown, wantedIndex: number): string | null {
  if (!Array.isArray(blanks)) {
    return null;
  }
  for (let position = 0; position < blanks.length; position++) {
    const raw = blanks[position] as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const index = typeof raw.index === 'number' ? raw.index : position;
    if (index !== wantedIndex) {
      continue;
    }
    return typeof raw.answer === 'string' && raw.answer.length > 0 ? raw.answer : null;
  }
  return null;
}
