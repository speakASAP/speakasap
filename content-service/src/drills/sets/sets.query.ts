import { Prisma } from '@prisma/client';
import { DrillSetDTO, DrillSetListQuery } from '../contracts';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export interface BuiltSetListQuery {
  where: Prisma.DrillSetWhereInput;
  orderBy: unknown;
  take: number;
  skip: number;
}

/**
 * Search with `q` DELIBERATELY IGNORES the course and lesson filters (spec 8.3).
 * A teacher who remembers a sentence but not which lesson it came from must
 * still find it; narrowing by lesson while searching would defeat the whole
 * point of the feature. Do not "fix" this by ANDing the filters back in.
 *
 * The `q` branch uses `contains` + insensitive mode rather than Prisma's
 * `search` operator: `fullTextSearch` is a preview feature and is not enabled
 * on this schema (Prisma 5.22). Slower than the GIN index allows, but correct,
 * and correctness ships first. The GIN index is already in place for when the
 * preview flag is turned on.
 */
export function buildSetListQuery(q: DrillSetListQuery): BuiltSetListQuery {
  const where: Prisma.DrillSetWhereInput = {};

  if (q.languageCode) {
    where.language = { code: q.languageCode };
  }
  if (q.materialLanguage) {
    where.materialLanguage = q.materialLanguage;
  }
  if (q.topicSlugs && q.topicSlugs.length > 0) {
    where.topicSlugs = { hasSome: q.topicSlugs };
  }
  if (q.reviewState) {
    where.reviewState = q.reviewState;
  }
  if (q.createdBy !== undefined) {
    where.createdByTeacherId = q.createdBy;
  }

  const term = q.q?.trim();
  if (term) {
    where.searchText = { contains: term, mode: 'insensitive' };
  } else {
    // Only narrow by position in the course when NOT searching.
    if (q.courseKey) {
      where.courseKey = q.courseKey;
    }
    if (q.lessonOrder !== undefined) {
      where.lessonOrder = q.lessonOrder;
    }
  }

  const orderBy =
    q.sort === 'recent'
      ? [{ createdAt: 'desc' }]
      : [{ popularityScore: 'desc' }, { createdAt: 'desc' }];

  const take = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = q.offset ?? 0;

  return { where, orderBy, take, skip };
}

/**
 * Buckets sets by `courseKey#lessonOrder`, with an `unassigned` bucket for
 * sets not tied to a lesson. This is the default library view.
 */
export function groupByLesson(sets: DrillSetDTO[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const set of sets) {
    const key =
      set.courseKey && set.lessonOrder !== null && set.lessonOrder !== undefined
        ? `${set.courseKey}#${set.lessonOrder}`
        : 'unassigned';
    (groups[key] ??= []).push(set.uuid);
  }
  return groups;
}
