import { AnalysisAttemptInput, AnalysisItemInput, FailedBlank } from './contracts';

interface ParsedBlank {
  index: number;
  answer: string;
  prompt: string | null;
}

/**
 * The blanks the student got wrong on a completed assignment.
 *
 * `mistakeCount` is the number of remedial sentences the answer earns, so it counts
 * **typed wrong attempts only** — a reveal is not a fourth mistake on top of three tries.
 * A blank revealed with nothing typed is still a failure, counted as one: not knowing an
 * answer and getting it wrong are the same gap.
 *
 * A blank with no attempts at all is not returned. The student never reached it; that is
 * an incomplete drill, not a mistake, and drilling it would teach nothing.
 */
export function extractFailedBlanks(
  items: AnalysisItemInput[],
  attempts: AnalysisAttemptInput[],
): FailedBlank[] {
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

  const failed: Array<FailedBlank & { order: number }> = [];

  for (const [key, tries] of grouped) {
    const [itemUuid] = key.split(':');
    const item = byItem.get(itemUuid);
    if (!item) {
      // An attempt whose item is gone. Deleted mid-drill by a teacher edit; there is no
      // sentence left to explain, so it cannot be analyzed.
      continue;
    }

    const blankIndex = Number(key.slice(itemUuid.length + 1));
    const blank = parseBlank(item.blanks, blankIndex);
    if (!blank) {
      continue;
    }

    const ordered = [...tries].sort((a, b) => a.attemptNo - b.attemptNo);
    const wrongAttempts = ordered
      .filter((t) => !t.isCorrect && !t.revealed)
      .map((t) => t.submittedValue);
    const revealed = ordered.some((t) => t.revealed);

    // Revealed with nothing typed still counts as one mistake — see the doc comment.
    const mistakeCount = wrongAttempts.length > 0 ? wrongAttempts.length : revealed ? 1 : 0;
    if (mistakeCount === 0) {
      continue;
    }

    failed.push({
      order: item.order,
      itemUuid,
      blankIndex: blank.index,
      answer: blank.answer,
      prompt: blank.prompt,
      sentence: item.template,
      wrongAttempts,
      revealed,
      mistakeCount,
    });
  }

  failed.sort((a, b) => (a.order - b.order) || (a.blankIndex - b.blankIndex));
  return failed.map(({ order: _order, ...rest }) => rest);
}

/** Reads one blank out of the item's Json column, tolerating a missing `index`. */
function parseBlank(blanks: unknown, wantedIndex: number): ParsedBlank | null {
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
    const answer = typeof raw.answer === 'string' ? raw.answer : '';
    if (!answer) {
      return null;
    }
    return {
      index,
      answer,
      prompt: typeof raw.prompt === 'string' && raw.prompt.length > 0 ? raw.prompt : null,
    };
  }

  return null;
}
