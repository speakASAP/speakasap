import { toAssignmentDTO } from '../assignment.mapper';
import { toSegments } from '../template';
import { DrillBlank, RunnerBlankDTO, RunnerItemDTO, RunnerResponse } from '../contracts';

/**
 * Headroom added to the longest accepted form when sizing the input box. Large
 * enough that a slightly longer valid inflection still fits, small enough that
 * the box is not a usable length oracle for the answer.
 */
const MAX_LENGTH_HEADROOM = 6;

/** The persisted attempt shape this projection reads. */
export interface AttemptLike {
  itemUuid: string;
  blankIndex: number;
  isCorrect: boolean;
  /** Track B handoff note 7: a revealed blank counts as resolved. */
  revealed?: boolean;
  submittedValue?: string | null;
}

/** The persisted item shape. `blanks` carries answers and must never be serialized. */
export interface DrillItemLike {
  uuid: string;
  order: number;
  template: string;
  blanks: DrillBlank[];
  hint: string | null;
}

/**
 * Project one persisted item into its ANSWER-FREE student-facing shape.
 *
 * SECURITY: every field on the returned blank is listed explicitly. Do not
 * replace this with a spread of the source blank, and do not add `answer` or
 * `alternatives` "just for debugging" — `blanks[].answer` and
 * `blanks[].alternatives` are the correct answers to the drill, and this
 * function is the only thing standing between them and the student's browser.
 * The projection spec asserts their absence; it was falsified by adding the
 * field back and watching the tests fail.
 *
 * `maxLength` is derived from the *length* of the accepted forms, never from
 * their text.
 */
export function toRunnerItem(item: DrillItemLike, attempts: AttemptLike[]): RunnerItemDTO {
  const forItem = attempts.filter((a) => a.itemUuid === item.uuid);
  const blanks: DrillBlank[] = Array.isArray(item.blanks) ? item.blanks : [];

  return {
    uuid: item.uuid,
    order: item.order,
    segments: toSegments(item.template),
    blanks: blanks.map((blank, index) => toRunnerBlank(blank, index, forItem)),
    hint: item.hint ?? null,
  };
}

function toRunnerBlank(
  blank: DrillBlank,
  index: number,
  attemptsForItem: AttemptLike[],
): RunnerBlankDTO {
  const blankIndex = typeof blank?.index === 'number' ? blank.index : index;
  const mine = attemptsForItem.filter((a) => a.blankIndex === blankIndex);
  const resolving = mine.find((a) => a.isCorrect === true || a.revealed === true);

  return {
    index: blankIndex,
    prompt: blank?.prompt ?? '',
    maxLength: maxLengthFor(blank),
    solved: Boolean(resolving),
    // Only the student's own typed text is ever echoed. A revealed blank has
    // nothing of theirs to echo, so it stays null rather than falling back to
    // the answer.
    solvedText: resolving?.isCorrect ? resolving.submittedValue ?? null : null,
  };
}

function maxLengthFor(blank: DrillBlank): number {
  const answer = typeof blank?.answer === 'string' ? blank.answer : '';
  const alternatives = Array.isArray(blank?.alternatives)
    ? blank.alternatives.filter((a): a is string => typeof a === 'string')
    : [];
  const longest = Math.max(answer.length, ...alternatives.map((a) => a.length), 0);
  return longest + MAX_LENGTH_HEADROOM;
}

/**
 * The full runner payload. Answer-free by construction: it is assembled from
 * `toAssignmentDTO` (which lists its fields explicitly) and `toRunnerItem`.
 *
 * `assignment` must satisfy `toAssignmentDTO`'s two preconditions — fetched with
 * `items` included, and a live Prisma row rather than JSON (Track B handoff
 * note 6).
 */
export function toRunnerResponse(
  assignment: any,
  items: DrillItemLike[],
  attempts: AttemptLike[],
  counts?: { blanksCorrect: number; blanksTotal: number },
): RunnerResponse {
  const resolvedCounts = counts ?? countResolved(items, attempts);
  return {
    assignment: toAssignmentDTO(assignment, resolvedCounts),
    items: [...items]
      .sort((a, b) => a.order - b.order)
      .map((item) => toRunnerItem(item, attempts)),
  };
}

/**
 * Fallback count when the caller does not supply one. Mirrors
 * `AssignmentsRepository.countBlanks`: a position counts as resolved when it was
 * answered correctly OR revealed, and the same position resolved twice counts
 * once.
 */
function countResolved(
  items: DrillItemLike[],
  attempts: AttemptLike[],
): { blanksCorrect: number; blanksTotal: number } {
  const resolved = new Set<string>();
  for (const a of attempts) {
    if (a.isCorrect === true || a.revealed === true) {
      resolved.add(`${a.itemUuid}#${a.blankIndex}`);
    }
  }
  const blanksTotal = items.reduce(
    (sum, item) => sum + (Array.isArray(item.blanks) ? item.blanks.length : 0),
    0,
  );
  return { blanksCorrect: resolved.size, blanksTotal };
}
