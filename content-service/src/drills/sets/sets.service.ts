import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { computePopularityScore } from './popularity';
import { buildSetListQuery, groupByLesson } from './sets.query';
import { hashItem, hashTemplateVariant, parseTemplate } from '../template';
import { sanitizeTemplate } from '../template-sanitize';
import { blanksFor, validateSentence } from '../sentence-editing';
import {
  DrillSetDetailDTO,
  DrillSetDTO,
  DrillSetListQuery,
  DrillSetListResponse,
  DrillSetOrigin,
  DrillSetReviewState,
  ValidationIssue,
  ValidationState,
} from '../contracts';

/** A replacement drill item, not yet persisted — this service assigns the id. */
export interface ReplacementItem {
  template: string;
  blanks: unknown[];
  hint: string | null;
  topicSlug: string;
}

/** A rating is a single up or down vote. Anything else is a client bug. */
const ALLOWED_RATING_VALUES = [1, -1];

export interface CreateSetInput {
  uuid: string;
  title: string;
  languageId: number;
  materialLanguage: string;
  level?: string | null;
  topicSlugs?: string[];
  courseKey?: string | null;
  lessonOrder?: number | null;
  origin: DrillSetOrigin;
  reviewState?: DrillSetReviewState;
  createdByTeacherId?: number | null;
  instructions?: string | null;
  visibility?: 'SHARED' | 'PRIVATE';
  knownWordRatio?: number | null;
  /** Existing bank rows to attach, in order. */
  itemIds: number[];
  /**
   * Items that have no bank row yet — AI output, essentially.
   *
   * Without this, an AI-generated set could not be created at all: `itemIds`
   * references rows that already exist, which is true of bank items and never
   * of generated ones. `GenerationService` filtered every AI candidate out and
   * sent `itemIds: []`, so the set arrived empty while the pipeline reported
   * READY, and the generated sentences were discarded after being paid for
   * (production, 2026-08-03).
   *
   * Rows are created inside the same transaction as the set: a set that exists
   * with no items looks identical to a finished one in a teacher's review
   * queue, so the two writes must not be separable.
   */
  newItems?: ReplacementItem[];
}

@Injectable()
export class SetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSet(input: CreateSetInput): Promise<DrillSetDetailDTO> {
    const reviewState = input.reviewState ?? 'PENDING_REVIEW';
    const created = await this.prisma.$transaction(async (tx: any) => {
      // Generated items become bank rows first, so the set can reference them by
      // id like any other. `upsertItem` hashes on plain text plus language, so a
      // sentence the bank already holds is reused rather than duplicated.
      //
      // `upsertItem` reads languageId, materialLanguage, level, courseKey and
      // lessonOrder off the set, which does not exist yet — it is handed the
      // input instead, which carries the same fields under the same names.
      const newItemIds: number[] = [];
      if (input.newItems?.length) {
        // The hash is over plain text plus the language *code*, but CreateSetInput
        // carries only the numeric id, so the code is resolved here. Getting this
        // wrong would hash every language into the same bucket and make two
        // different languages' identical sentences collide.
        const language = await tx.language.findUnique({
          where: { id: input.languageId },
          select: { code: true },
        });
        const languageCode = language?.code ?? '';

        for (const item of input.newItems) {
          newItemIds.push(await this.upsertItem(tx, input, languageCode, item));
        }
      }

      // Bank items keep the order the generator chose; generated ones follow.
      // Interleaving them would reorder a set the pipeline already sequenced.
      const itemIds = [...input.itemIds, ...newItemIds];

      const set = await tx.drillSet.create({
        data: {
          uuid: input.uuid,
          title: input.title,
          languageId: input.languageId,
          materialLanguage: input.materialLanguage,
          level: input.level ?? null,
          topicSlugs: input.topicSlugs ?? [],
          courseKey: input.courseKey ?? null,
          lessonOrder: input.lessonOrder ?? null,
          origin: input.origin,
          reviewState,
          createdByTeacherId: input.createdByTeacherId ?? null,
          instructions: input.instructions ?? null,
          visibility: input.visibility ?? 'SHARED',
          knownWordRatio: input.knownWordRatio ?? null,
          // Filled by updateSearchText once the items are attached.
          searchText: '',
          popularityScore: computePopularityScore({
            teacherUpvotes: 0,
            studentUpvotes: 0,
            timesAssigned: 0,
            timesSelfSelected: 0,
            reviewState,
          }),
          items: {
            create: itemIds.map((itemId, index) => ({ itemId, order: index })),
          },
        },
        include: { items: { include: { item: true }, orderBy: { order: 'asc' } } },
      });
      return set;
    });

    await this.updateSearchText(input.uuid);
    return this.getSet(input.uuid);
  }

  /**
   * Library listing. Answer-free by construction: it returns DrillSetDTO, not
   * DrillSetDetailDTO, so no item template or blank ever reaches the response.
   *
   * `maxLessonOrder` clamps to sets at or below the caller's position in the
   * course; it is applied here rather than in buildSetListQuery because it is
   * a caller-authorization concern, not a search filter.
   */
  async list(
    query: DrillSetListQuery & { maxLessonOrder?: number },
  ): Promise<DrillSetListResponse> {
    const { where, orderBy, take, skip } = buildSetListQuery(query);
    if (query.maxLessonOrder !== undefined) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: [{ lessonOrder: { lte: query.maxLessonOrder } }, { lessonOrder: null }] },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.drillSet.findMany({
        where,
        orderBy: orderBy as any,
        take,
        skip,
        include: { language: true, _count: { select: { items: true } } },
      }),
      this.prisma.drillSet.count({ where }),
    ]);

    const sets = rows.map((row: any) => this.toDTO(row));
    const response: DrillSetListResponse = { sets, total };
    if (query.groupBy === 'lesson') {
      response.groups = groupByLesson(sets);
    }
    return response;
  }

  async getSet(uuid: string): Promise<DrillSetDetailDTO> {
    const set = await this.prisma.drillSet.findUnique({
      where: { uuid },
      include: { items: { include: { item: true }, orderBy: { order: 'asc' } } },
    });
    if (!set) {
      throw new NotFoundException(`Drill set ${uuid} not found`);
    }
    return this.toDetailDTO(set);
  }

  /**
   * A set may be approved with WARN or OVERRIDDEN items — a warning is advisory
   * and an override is a teacher's explicit decision. An open FAIL is neither,
   * so it blocks with contract C7's UNRESOLVED_VALIDATION_FAILURES.
   *
   * Idempotent: approving an already-approved set is a no-op that still
   * returns the set, so a double-click cannot 409.
   */
  async approveSet(uuid: string, teacherId: number): Promise<DrillSetDTO> {
    return this.prisma.$transaction(async (tx: any) => {
      const set = await tx.drillSet.findUnique({
        where: { uuid },
        include: { items: true },
      });
      if (!set) {
        throw new NotFoundException(`Drill set ${uuid} not found`);
      }

      const unresolved = (set.items ?? []).filter(
        (item: { validationState: ValidationState }) => item.validationState === 'FAIL',
      );
      if (unresolved.length > 0) {
        throw new ConflictException({
          statusCode: 409,
          code: 'UNRESOLVED_VALIDATION_FAILURES',
          message: `${unresolved.length} item(s) still fail validation; fix or override them before approving`,
        });
      }

      const updated = await tx.drillSet.update({
        where: { uuid },
        data: {
          reviewState: 'APPROVED',
          approvedAt: set.approvedAt ?? new Date(),
          popularityScore: computePopularityScore({
            teacherUpvotes: set.teacherUpvotes ?? 0,
            studentUpvotes: set.studentUpvotes ?? 0,
            timesAssigned: set.timesAssigned ?? 0,
            timesSelfSelected: set.timesSelfSelected ?? 0,
            reviewState: 'APPROVED',
          }),
        },
      });
      return this.toDTO(updated);
    });
  }

  /**
   * Replaces the items at the given `order` positions, writing the outgoing rows to
   * DrillItemRevision first. Called by education-service's regeneration loop
   * (Track D) when a teacher rejects items and asks for new ones.
   *
   * One transaction throughout: a revision written without the swap, or a swap without
   * the revision, is worse than neither — the first loses nothing but lies about
   * history, the second destroys the sentence the teacher wanted to compare against.
   *
   * The replaced positions return to PENDING validation. They have not been through
   * the validator in this set, and inheriting the old item's PASS would mark an
   * unexamined sentence as checked.
   */
  async replaceSetItems(
    uuid: string,
    positions: number[],
    replacements: ReplacementItem[],
    options: { recordRevisionReason: string },
  ): Promise<DrillSetDetailDTO> {
    if (positions.length !== replacements.length) {
      throw new BadRequestException(
        `positions and replacements must be the same length (${positions.length} vs ${replacements.length})`,
      );
    }
    if (positions.length === 0) {
      throw new BadRequestException('at least one position is required');
    }

    await this.prisma.$transaction(async (tx: any) => {
      const set = await tx.drillSet.findUnique({
        where: { uuid },
        include: { items: { include: { item: true } }, language: true },
      });
      if (!set) {
        throw new NotFoundException(`Drill set ${uuid} not found`);
      }

      const languageCode = set.language?.code ?? '';

      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        const target = (set.items ?? []).find((row: any) => row.order === position);
        if (!target) {
          throw new BadRequestException(`Set ${uuid} has no item at position ${position}`);
        }

        // History first. If anything below fails, the transaction takes this with it.
        await tx.drillItemRevision.create({
          data: {
            itemId: target.itemId,
            template: target.item.template,
            blanks: target.item.blanks ?? [],
            hint: target.item.hint ?? null,
            reason: options.recordRevisionReason,
          },
        });

        const itemId = await this.upsertItem(tx, set, languageCode, replacements[i]);

        await tx.drillSetItem.update({
          where: { id: target.id },
          data: {
            itemId,
            validationState: 'PENDING',
            validationIssues: [],
            validatedAt: null,
          },
        });
      }
    });

    await this.updateSearchText(uuid);
    return this.getSet(uuid);
  }

  /**
   * Edits one sentence of a set on a teacher's instruction.
   *
   * Distinct from `replaceSetItems`, which installs generated replacements at fixed
   * positions: here the teacher wrote the template, so it is validated rather than
   * trusted, and rejected as a whole if it would not work as a drill.
   *
   * The three fields are independent. A template change re-derives `blanks` and takes a
   * new bank row; a hint-only change edits the existing row in place; a
   * `validationState` change records the teacher's override. Passing several at once is
   * allowed and each is applied.
   */
  async updateSetItem(
    uuid: string,
    itemId: number,
    patch: { template?: string; hint?: string | null; validationState?: ValidationState },
  ): Promise<DrillSetDetailDTO> {
    // Validated before the transaction opens: a rejected sentence must not leave a
    // revision row or a half-applied patch behind.
    const template =
      patch.template === undefined ? undefined : this.assertValidSentence(patch.template);

    await this.prisma.$transaction(async (tx: any) => {
      const set = await tx.drillSet.findUnique({
        where: { uuid },
        include: { items: { include: { item: true } }, language: true },
      });
      if (!set) {
        throw new NotFoundException(`Drill set ${uuid} not found`);
      }

      const target = (set.items ?? []).find((row: any) => row.id === itemId);
      if (!target) {
        throw new NotFoundException(`Drill set ${uuid} has no item ${itemId}`);
      }

      const data: Record<string, unknown> = {};

      if (template !== undefined) {
        // History first, same ordering as replaceSetItems: if anything below fails the
        // transaction takes this with it.
        await tx.drillItemRevision.create({
          data: {
            itemId: target.itemId,
            template: target.item.template,
            blanks: target.item.blanks ?? [],
            hint: target.item.hint ?? null,
            reason: 'TEACHER_EDITED',
          },
        });

        data.itemId = await this.upsertItem(
          tx,
          set,
          set.language?.code ?? '',
          {
            template,
            blanks: blanksFor(template),
            hint: patch.hint === undefined ? (target.item.hint ?? null) : patch.hint,
            topicSlug: '',
          },
          'TEACHER',
        );

        // The teacher who wrote the sentence is the reviewer. Returning it to PENDING
        // would block their own approve button on an item they just authored.
        data.validationState = 'PASS';
        data.validationIssues = [];
        data.validatedAt = new Date();
      } else if (patch.hint !== undefined) {
        // No new bank row for a hint: the sentence is unchanged, so its hash and every
        // set already pointing at it stay correct.
        await tx.drillItem.update({
          where: { id: target.itemId },
          data: { hint: patch.hint },
        });
      }

      if (patch.validationState !== undefined) {
        data.validationState = patch.validationState;
      }

      if (Object.keys(data).length > 0) {
        await tx.drillSetItem.update({ where: { id: itemId }, data });
      }
    });

    await this.updateSearchText(uuid);
    return this.getSet(uuid);
  }

  /**
   * Removes one sentence from a set and closes the gap in `order`.
   *
   * Positions are renumbered because the review and progress screens label sentences by
   * position ("Sentence 3"), so a hole makes the list skip a number. The bank row itself
   * is left alone — it may be referenced by other sets, and deleting a sentence from
   * this set is not a statement about the sentence.
   */
  async deleteSetItem(uuid: string, itemId: number): Promise<DrillSetDetailDTO> {
    await this.prisma.$transaction(async (tx: any) => {
      const set = await tx.drillSet.findUnique({
        where: { uuid },
        include: { items: { include: { item: true } } },
      });
      if (!set) {
        throw new NotFoundException(`Drill set ${uuid} not found`);
      }

      const items = set.items ?? [];
      const target = items.find((row: any) => row.id === itemId);
      if (!target) {
        throw new NotFoundException(`Drill set ${uuid} has no item ${itemId}`);
      }
      if (items.length <= 1) {
        // A set with no sentences cannot be approved and cannot be drilled. Refusing
        // here is clearer than letting a teacher create one and discover it later.
        throw new BadRequestException(
          'A set needs at least one sentence. Delete the whole set instead.',
        );
      }

      await tx.drillSetItem.delete({ where: { id: itemId } });

      // Ascending, and only after sorting: `@@unique([setUuid, order])` is checked per
      // statement, not at commit, so a row shifted down onto an order its neighbour
      // still holds aborts the whole transaction — the delete then fails and the
      // teacher is told the sentence could not be removed. Prisma gives no ordering
      // guarantee for included relation rows, so iterating `items` as received moved
      // higher positions first and collided. Sorting first means every gap is closed
      // before the next row moves into it.
      const survivors = items
        .filter((row: any) => row.order > target.order)
        .sort((a: any, b: any) => a.order - b.order);

      for (const row of survivors) {
        await tx.drillSetItem.update({ where: { id: row.id }, data: { order: row.order - 1 } });
      }
    });

    await this.updateSearchText(uuid);
    return this.getSet(uuid);
  }

  /** Appends a teacher-written sentence to the end of a set. */
  async addSetItem(
    uuid: string,
    input: { template: string; hint: string | null },
  ): Promise<DrillSetDetailDTO> {
    const template = this.assertValidSentence(input.template);

    await this.prisma.$transaction(async (tx: any) => {
      const set = await tx.drillSet.findUnique({
        where: { uuid },
        include: { items: true, language: true },
      });
      if (!set) {
        throw new NotFoundException(`Drill set ${uuid} not found`);
      }

      const orders = (set.items ?? []).map((row: any) => row.order);
      const nextOrder = orders.length === 0 ? 0 : Math.max(...orders) + 1;

      const newItemId = await this.upsertItem(
        tx,
        set,
        set.language?.code ?? '',
        {
          template,
          blanks: blanksFor(template),
          hint: input.hint,
          topicSlug: '',
        },
        'TEACHER',
      );

      await tx.drillSetItem.create({
        data: {
          // By uuid: the relation is `setUuid -> DrillSet.uuid` and `drill_set` has no
          // id column, so `setId` was an unknown argument and every Add sentence failed.
          setUuid: set.uuid,
          itemId: newItemId,
          order: nextOrder,
          // The teacher authored it, so it is reviewed by definition — same reasoning
          // as the template branch of updateSetItem.
          validationState: 'PASS',
          validationIssues: [],
          validatedAt: new Date(),
        },
      });
    });

    await this.updateSearchText(uuid);
    return this.getSet(uuid);
  }

  /**
   * The sentence, sanitized, or a 400 naming every reason it cannot be saved.
   *
   * Every problem is reported at once rather than the first: a teacher discovering
   * errors one save at a time is the experience this avoids. The issues ride on the
   * response body so the review screen can render them exactly as it renders the
   * generator's own findings.
   */
  private assertValidSentence(raw: string): string {
    const template = sanitizeTemplate(raw ?? '');
    const issues = validateSentence(template);
    if (issues.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: issues.map((issue) => issue.message).join(' '),
        validationIssues: issues,
      });
    }
    return template;
  }

  /**
   * DrillItem.hash is @unique, so a replacement that happens to match a sentence already
   * in the bank must reuse that row rather than insert a colliding one. A blind create
   * would fail the whole regeneration with a constraint error the teacher cannot act on.
   */
  private async upsertItem(
    tx: any,
    set: any,
    languageCode: string,
    replacement: ReplacementItem,
    /**
     * Where the sentence came from. Defaults to AI because every pre-existing caller is
     * the generation pipeline; teacher edits pass TEACHER so the bank records who wrote
     * a sentence and bank-selection statistics are not polluted with hand-written rows
     * attributed to the model.
     */
    sourceType: 'AI' | 'TEACHER' = 'AI',
  ): Promise<number> {
    // Sanitized before anything is derived from it: `plainText` and `hash` are computed
    // from the template, so markup left here would poison the dedup hash as well as the
    // rendered sentence. The legacy bank importer stored raw labels, which is how 14,567
    // rows came to show `<span class="mute">` as literal text in the review screen. This
    // is the single chokepoint for every newly created item, so the guard belongs here
    // rather than only in the importer that happened to cause it.
    const template = sanitizeTemplate(replacement.template);
    const parsed = parseTemplate(template);
    const plainHash = hashItem(parsed.plainText, languageCode);

    // Reuse only a row that carries the very same template. The bank's hash is computed
    // from the plain text with the answers substituted in, so every way of blanking one
    // sentence collides on it — and returning the colliding row here silently handed a
    // teacher back the sentence they had just re-blanked, reporting the edit as saved.
    // A sentence whose blanks differ is a different exercise and gets its own row, keyed
    // by the markup so the @unique hash accepts it alongside the original.
    const existing = await tx.drillItem.findUnique({ where: { hash: plainHash } });
    if (existing?.template === template) {
      return existing.id;
    }

    const hash = existing ? hashTemplateVariant(template, languageCode) : plainHash;
    const variant = existing
      ? await tx.drillItem.findUnique({ where: { hash } })
      : null;
    if (variant) {
      return variant.id;
    }

    const topic = replacement.topicSlug
      ? await tx.drillTopic.findFirst({ where: { slug: replacement.topicSlug } })
      : null;

    const created = await tx.drillItem.create({
      data: {
        languageId: set.languageId,
        materialLanguage: set.materialLanguage,
        topicId: topic?.id ?? null,
        level: set.level ?? null,
        template,
        blanks: replacement.blanks as any,
        plainText: parsed.plainText,
        hint: replacement.hint ?? null,
        sourceType,
        courseKey: set.courseKey ?? null,
        lessonOrder: set.lessonOrder ?? null,
        unknownWords: [],
        hash,
      },
    });
    return created.id;
  }

  /**
   * Patches a set's review state.
   *
   * APPROVED is deliberately NOT grantable here. It is the flag that makes a set visible
   * to a student, and `approveSet` is where the "no item is still FAIL" check lives;
   * allowing it through a generic patch would route around that check entirely.
   */
  async updateSet(
    uuid: string,
    patch: { reviewState?: DrillSetReviewState },
  ): Promise<DrillSetDTO> {
    const allowed: DrillSetReviewState[] = ['GENERATING', 'VALIDATING', 'PENDING_REVIEW'];
    if (!patch.reviewState || !allowed.includes(patch.reviewState)) {
      throw new BadRequestException(
        `reviewState must be one of ${allowed.join(', ')} (use the approve route to approve a set)`,
      );
    }

    const set = await this.prisma.drillSet.findUnique({ where: { uuid } });
    if (!set) {
      throw new NotFoundException(`Drill set ${uuid} not found`);
    }

    const updated = await this.prisma.drillSet.update({
      where: { uuid },
      data: {
        reviewState: patch.reviewState,
        // Clearing this matters: a set that fell out of APPROVED but kept its
        // approvedAt reads as approved to anything that checks the timestamp.
        approvedAt: null,
        popularityScore: computePopularityScore({
          teacherUpvotes: set.teacherUpvotes ?? 0,
          studentUpvotes: set.studentUpvotes ?? 0,
          timesAssigned: set.timesAssigned ?? 0,
          timesSelfSelected: set.timesSelfSelected ?? 0,
          reviewState: patch.reviewState,
        }),
      },
    });
    return this.toDTO(updated);
  }

  /**
   * One vote per rater per set, changeable — hence the upsert on the unique
   * key. Vote totals are recounted from the rating rows rather than
   * incremented, so a changed vote cannot drift the stored counter.
   */
  async recordRating(
    uuid: string,
    raterType: 'TEACHER' | 'STUDENT',
    raterId: number,
    value: number,
    comment?: string,
  ): Promise<DrillSetDTO> {
    if (!ALLOWED_RATING_VALUES.includes(value)) {
      throw new BadRequestException('Rating value must be +1 or -1');
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.drillSetRating.upsert({
        where: { setUuid_raterType_raterId: { setUuid: uuid, raterType, raterId } },
        create: { setUuid: uuid, raterType, raterId, value, comment: comment ?? null },
        update: { value, comment: comment ?? null },
      });

      const totals = await tx.drillSetRating.groupBy({
        by: ['raterType'],
        where: { setUuid: uuid },
        _sum: { value: true },
      });
      const sumFor = (type: string) =>
        totals.find((row: { raterType: string }) => row.raterType === type)?._sum?.value ?? 0;
      const teacherUpvotes = sumFor('TEACHER');
      const studentUpvotes = sumFor('STUDENT');

      const set = await tx.drillSet.findUnique({ where: { uuid } });
      if (!set) {
        throw new NotFoundException(`Drill set ${uuid} not found`);
      }

      const updated = await tx.drillSet.update({
        where: { uuid },
        data: {
          teacherUpvotes,
          studentUpvotes,
          popularityScore: computePopularityScore({
            teacherUpvotes,
            studentUpvotes,
            timesAssigned: set.timesAssigned ?? 0,
            timesSelfSelected: set.timesSelfSelected ?? 0,
            reviewState: set.reviewState as DrillSetReviewState,
          }),
        },
      });
      return this.toDTO(updated);
    });
  }

  /**
   * Denormalizes the set's item text onto the row so library search is one
   * indexed GIN lookup rather than a join and a scan. Call after any change to
   * the set's items.
   */
  async updateSearchText(uuid: string): Promise<void> {
    const items = await this.prisma.drillSetItem.findMany({
      where: { setUuid: uuid },
      include: { item: true },
      orderBy: { order: 'asc' },
    });
    const searchText = items
      .map((row: { item?: { plainText?: string } }) => row.item?.plainText ?? '')
      .filter(Boolean)
      .join(' \n ');
    await this.prisma.drillSet.update({ where: { uuid }, data: { searchText } });
  }

  private toDTO(set: any): DrillSetDTO {
    return {
      uuid: set.uuid,
      title: set.title,
      languageCode: set.language?.code ?? set.languageCode ?? '',
      materialLanguage: set.materialLanguage,
      level: set.level ?? null,
      topicSlugs: set.topicSlugs ?? [],
      courseKey: set.courseKey ?? null,
      lessonOrder: set.lessonOrder ?? null,
      origin: set.origin,
      reviewState: set.reviewState,
      createdByTeacherId: set.createdByTeacherId ?? null,
      instructions: set.instructions ?? null,
      visibility: set.visibility,
      knownWordRatio: set.knownWordRatio ?? null,
      timesAssigned: set.timesAssigned ?? 0,
      timesSelfSelected: set.timesSelfSelected ?? 0,
      teacherUpvotes: set.teacherUpvotes ?? 0,
      studentUpvotes: set.studentUpvotes ?? 0,
      popularityScore: set.popularityScore ?? 0,
      itemCount: set.items?.length ?? set._count?.items ?? 0,
      createdAt: toIso(set.createdAt),
      approvedAt: set.approvedAt ? toIso(set.approvedAt) : null,
    };
  }

  /** Carries answers. Teacher/staff auth only — never returned to a student. */
  private toDetailDTO(set: any): DrillSetDetailDTO {
    return {
      ...this.toDTO(set),
      items: (set.items ?? []).map((row: any) => ({
        id: row.id,
        order: row.order,
        item: {
          id: row.item.id,
          languageCode: row.item.language?.code ?? '',
          materialLanguage: row.item.materialLanguage,
          topicSlug: row.item.topic?.slug ?? null,
          level: row.item.level ?? null,
          template: row.item.template,
          blanks: row.item.blanks ?? [],
          hint: row.item.hint ?? null,
          sourceType: row.item.sourceType,
          courseKey: row.item.courseKey ?? null,
          lessonOrder: row.item.lessonOrder ?? null,
          unknownWords: row.item.unknownWords ?? [],
          hash: row.item.hash,
        },
        validationState: row.validationState,
        validationIssues: (row.validationIssues ?? []) as ValidationIssue[],
        validatedAt: row.validatedAt ? toIso(row.validatedAt) : null,
      })),
    };
  }
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
