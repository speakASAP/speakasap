import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { computePopularityScore } from './popularity';
import {
  DrillSetDetailDTO,
  DrillSetDTO,
  DrillSetOrigin,
  DrillSetReviewState,
  ValidationIssue,
  ValidationState,
} from '../contracts';

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
  itemIds: number[];
}

@Injectable()
export class SetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSet(input: CreateSetInput): Promise<DrillSetDetailDTO> {
    const reviewState = input.reviewState ?? 'PENDING_REVIEW';
    const created = await this.prisma.$transaction(async (tx: any) => {
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
            create: input.itemIds.map((itemId, index) => ({ itemId, order: index })),
          },
        },
        include: { items: { include: { item: true }, orderBy: { order: 'asc' } } },
      });
      return set;
    });

    await this.updateSearchText(input.uuid);
    return this.getSet(input.uuid);
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
