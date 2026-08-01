import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SetsService, CreateSetInput, ReplacementItem } from './sets.service';
import { DrillSetDetailDTO, DrillSetDTO, DrillSetListResponse, DrillSetReviewState } from '../contracts';

/** Identity of the caller, resolved upstream. Never read from the request body. */
export interface RaterContext {
  raterId: number;
  raterType: 'TEACHER' | 'STUDENT';
}

export interface StudentScope {
  courseKey?: string;
  lessonOrder?: number;
}

// No @UseGuards here, following the unanimous existing pattern in this service:
// content-service has no auth guard, no JWT/passport dependency and no `src/auth/`
// directory. Auth is enforced upstream at the gateway. See the identical note in
// drills.controller.ts.
//
// SECURITY: the split between the two read paths below is the whole point of this
// controller. `available-for-me` and the list route return DrillSetDTO, which carries
// no item text and therefore no answers. The full-detail route returns
// DrillSetDetailDTO, which DOES carry DrillBlank.answer/.alternatives for every item,
// so it lives under the `internal/` prefix that the gateway gates behind
// x-internal-token — exactly as Task A.8 did for drill-items/search. The gateway's
// auth guard validates a token but performs NO role check, so a public prefix here
// would let any authenticated student harvest the answer bank.
@Controller()
export class SetsController {
  private readonly logger = new Logger(SetsController.name);

  constructor(private readonly setsService: SetsService) {}

  @Get('drill-sets')
  async list(@Query() query: any): Promise<DrillSetListResponse> {
    return this.setsService.list({
      languageCode: query.languageCode,
      materialLanguage: query.materialLanguage,
      topicSlugs: toArray(query.topicSlugs),
      courseKey: query.courseKey,
      lessonOrder: toInt(query.lessonOrder),
      q: query.q,
      sort: query.sort,
      createdBy: toInt(query.createdBy),
      reviewState: query.reviewState,
      groupBy: query.groupBy,
      limit: toInt(query.limit),
      offset: toInt(query.offset),
    });
  }

  /**
   * The student-facing library. Two rules, both enforced here rather than
   * trusted to the caller:
   *   - only APPROVED sets are visible;
   *   - nothing beyond the student's current lesson.
   * The response is DrillSetDTO[], which carries no answers.
   */
  @Get('drill-sets/available-for-me')
  async availableForMe(scope: StudentScope): Promise<DrillSetListResponse> {
    const start = Date.now();
    const result = await this.setsService.list({
      reviewState: 'APPROVED',
      courseKey: scope.courseKey,
      maxLessonOrder: scope.lessonOrder,
      sort: 'popularity',
    });
    this.logger.log(
      `Student drill-set library: returned=${result.sets.length} courseKey=${scope.courseKey || 'none'} maxLessonOrder=${scope.lessonOrder ?? 'none'} latencyMs=${Date.now() - start}`,
    );
    return result;
  }

  // Internal-only: carries answers. See the class-level security note.
  @Get('internal/drill-sets/:uuid')
  async getSet(@Param('uuid') uuid: string): Promise<DrillSetDetailDTO> {
    return this.setsService.getSet(uuid);
  }

  @Post('internal/drill-sets')
  @HttpCode(HttpStatus.CREATED)
  async createSet(@Body() body: CreateSetInput): Promise<DrillSetDetailDTO> {
    if (!body?.uuid) {
      throw new BadRequestException('uuid is required');
    }
    if (!body?.title) {
      throw new BadRequestException('title is required');
    }
    if (!Array.isArray(body?.itemIds)) {
      throw new BadRequestException('itemIds is required (may be an empty array)');
    }
    return this.setsService.createSet(body);
  }

  /**
   * Replaces items at given `order` positions. Internal-only for the same reason as the
   * detail route above: the request body carries `blanks`, and `blanks` carries answers.
   *
   * Called by education-service's regeneration loop when a teacher rejects items.
   */
  @Post('internal/drill-sets/:uuid/replace-items')
  @HttpCode(HttpStatus.OK)
  async replaceSetItems(
    @Param('uuid') uuid: string,
    @Body()
    body: {
      positions?: number[];
      items?: ReplacementItem[];
      recordRevisionReason?: string;
    },
  ): Promise<DrillSetDetailDTO> {
    if (!Array.isArray(body?.positions) || !Array.isArray(body?.items)) {
      throw new BadRequestException('positions and items are required arrays');
    }
    if (!body.recordRevisionReason) {
      // The revision reason is what makes the history readable later. An unlabelled
      // revision row tells a teacher a sentence changed but not why.
      throw new BadRequestException('recordRevisionReason is required');
    }
    return this.setsService.replaceSetItems(uuid, body.positions, body.items, {
      recordRevisionReason: body.recordRevisionReason,
    });
  }

  /**
   * Patches a set's review state. APPROVED is not grantable here — see updateSet.
   */
  @Post('internal/drill-sets/:uuid/update')
  @HttpCode(HttpStatus.OK)
  async updateSet(
    @Param('uuid') uuid: string,
    @Body() body: { reviewState?: DrillSetReviewState },
  ): Promise<DrillSetDTO> {
    return this.setsService.updateSet(uuid, { reviewState: body?.reviewState });
  }

  @Post('internal/drill-sets/:uuid/approve')
  @HttpCode(HttpStatus.OK)
  async approveSet(
    @Param('uuid') uuid: string,
    @Body() body: { teacherId?: number },
  ): Promise<DrillSetDTO> {
    const teacherId = Number(body?.teacherId);
    if (!Number.isInteger(teacherId) || teacherId <= 0) {
      throw new BadRequestException('numeric teacherId is required');
    }
    return this.setsService.approveSet(uuid, teacherId);
  }

  /**
   * The rater is taken from the resolved caller context, never from the body —
   * otherwise a student could cast a teacher-weighted vote (3x) or vote as
   * someone else. Spec 8.3 states this explicitly.
   */
  @Post('drill-sets/:uuid/ratings')
  @HttpCode(HttpStatus.OK)
  async rateSet(
    @Param('uuid') uuid: string,
    @Body() body: { value: number; comment?: string },
    rater: RaterContext,
  ): Promise<DrillSetDTO> {
    return this.setsService.recordRating(uuid, rater.raterType, rater.raterId, body?.value, body?.comment);
  }
}

function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? (value as string[]) : String(value).split(',').filter(Boolean);
}

function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
