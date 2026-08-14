import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  DrillSetDetailDTO,
  DrillSetItemDTO,
  GeneratedDrillItem,
  ItemValidationResult,
  ValidationIssue,
  VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE,
} from '../contracts';
import { parseTemplate } from '../template';
import { AiClient } from './ai.client';
import { ContentClient } from './content.client';
import { runPreChecks } from './pre-checks';

export interface RegenerationJobContext {
  /** Caller's bearer token, forwarded to both upstreams. */
  token: string;
  correlationId: string;
  /** content-service's numeric language id. */
  languageId: number;
}

/**
 * The teacher-driven regeneration loop, spec §7.3.
 *
 * A teacher rejects some items in a set and gets replacements for exactly those
 * positions. There is deliberately **no iteration limit**: a teacher who wants a
 * fifth round is doing exactly what this feature is for, and capping it would put a
 * set the teacher considers unfinished into a student's hands.
 */
@Injectable()
export class RegenerationService {
  private readonly logger = new Logger(RegenerationService.name);

  constructor(
    private readonly content: ContentClient,
    private readonly ai: AiClient,
  ) {}

  async regenerate(
    setUuid: string,
    itemIds: number[],
    note: string | undefined,
    ctx: RegenerationJobContext,
  ): Promise<void> {
    const started = Date.now();
    const set = await this.content.getSet(setUuid, ctx.token);

    const rejected = itemIds.map((id) => findSetItem(set, id));
    const rejectedIds = new Set(itemIds);
    const survivingTexts = set.items
      .filter((i) => !rejectedIds.has(i.id))
      .map((i) => plainTextOf(i));

    const baseline = await this.resolveBaseline(set, ctx);

    // The validator's own complaints are the single most useful thing to tell the
    // generator: they say precisely why the last attempt was wrong. Dropping them
    // means asking the same question again and getting the same answer.
    const instructions = composeInstructions(set.instructions, rejected, note, set.topicSlugs);

    const generated = await this.ai.generate(
      {
        languageCode: set.languageCode,
        materialLanguage: set.materialLanguage,
        level: set.level,
        topics: set.topicSlugs.map((slug) => ({ slug, title: slug })),
        instructions,
        count: itemIds.length,
        knownVocabulary: baseline?.index ?? [],
        maxNewWordsPerSentence: VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE,
        exampleItems: survivingTexts.slice(0, 3),
        avoidTexts: survivingTexts,
        correlationId: ctx.correlationId,
      },
      ctx.token,
    );

    const survivors = await this.screen(set, generated.items, baseline, instructions, ctx);

    // Nothing usable came back. Leaving the set exactly as it was is the only safe
    // outcome: blanking the rejected positions would silently shrink a set the teacher
    // is in the middle of reviewing.
    if (survivors.length === 0) {
      this.logger.warn(
        `Regeneration produced no usable items: set=${setUuid} requested=${itemIds.length}`,
      );
      return;
    }

    await this.content.replaceSetItems(
      setUuid,
      rejected.map((i) => i.order),
      survivors.map((item) => ({
        template: item.template,
        blanks: item.blanks,
        hint: item.hint,
        topicSlug: item.topicSlug,
      })),
      { recordRevisionReason: 'REGENERATED' },
      ctx.token,
    );

    // Any change to the items invalidates an earlier approval — the approved thing is
    // not the thing that is now in the set.
    await this.content.updateSet(setUuid, { reviewState: 'PENDING_REVIEW' }, ctx.token);

    this.logger.log(
      `Regeneration complete: set=${setUuid} requested=${itemIds.length} replaced=${survivors.length} latencyMs=${Date.now() - started}`,
    );
  }

  /**
   * Regenerated items pass through the same gates as first-round ones: deterministic
   * pre-checks, then the validator. Skipping them because "the teacher asked for these"
   * is how an ungrammatical replacement lands in an already-reviewed set.
   */
  private async screen(
    set: DrillSetDetailDTO,
    items: GeneratedDrillItem[],
    baseline: any,
    instructions: string,
    ctx: RegenerationJobContext,
  ): Promise<GeneratedDrillItem[]> {
    if (items.length === 0) {
      return [];
    }

    const preChecked = runPreChecks(
      items.map((i) => ({ template: i.template, blanks: i.blanks, hint: i.hint })),
      {
        languageCode: set.languageCode,
        materialLanguage: set.materialLanguage,
        topicSlugs: set.topicSlugs,
        baseline: baseline ?? undefined,
        existingHashes: new Set<string>(),
      },
    );
    const preSurvivors = items.filter((_item, i) => !preChecked[i].fatal);
    if (preSurvivors.length === 0) {
      return [];
    }

    const validated = await this.ai.validate(
      {
        languageCode: set.languageCode,
        materialLanguage: set.materialLanguage,
        level: set.level,
        topics: set.topicSlugs.map((slug) => ({ slug, title: slug })),
        instructions,
        items: preSurvivors.map((item, itemRef) => ({
          itemRef,
          template: item.template,
          blanks: item.blanks,
          hint: item.hint,
        })),
        correlationId: ctx.correlationId,
      },
      ctx.token,
    );

    const failed = new Set(
      validated.results
        .filter((r: ItemValidationResult) => r.state === 'FAIL')
        .map((r: ItemValidationResult) => r.itemRef),
    );
    return preSurvivors.filter((_item, i) => !failed.has(i));
  }

  private async resolveBaseline(set: DrillSetDetailDTO, ctx: RegenerationJobContext) {
    if (!set.courseKey || set.lessonOrder === null) {
      return null;
    }
    return this.content.getBaseline(set.courseKey, set.languageCode, set.lessonOrder, ctx.token);
  }
}

function findSetItem(set: DrillSetDetailDTO, itemId: number): DrillSetItemDTO {
  const found = set.items.find((i) => i.id === itemId);
  if (!found) {
    // Regenerating an id that is not in this set would replace a position the teacher
    // never rejected, in a set they may not even be looking at.
    throw new BadRequestException(`Item ${itemId} is not part of set ${set.uuid}`);
  }
  return found;
}

/** plainText is carried alongside the DTO by content-service's set detail projection. */
function plainTextOf(setItem: DrillSetItemDTO): string {
  const carried = (setItem.item as { plainText?: string }).plainText;
  return carried ?? parseTemplate(setItem.item.template).plainText;
}

function composeInstructions(
  original: string | null,
  rejected: DrillSetItemDTO[],
  note: string | undefined,
  topicSlugs: string[],
): string {
  const parts: string[] = [];
  if (original && original.trim()) {
    parts.push(original.trim());
  } else if (topicSlugs.length > 0) {
    // A set built from topics alone carries no instructions, and ai-microservice
    // rejects an empty brief outright (`@IsNotEmpty`, 400). The topics are what the
    // teacher asked for, so they stand in for the words they never typed.
    parts.push(`Drill these grammar topics: ${topicSlugs.join(', ')}.`);
  }

  const issues = rejected
    .flatMap((item) => (item.validationIssues ?? []) as ValidationIssue[])
    .map((issue) => `- ${issue.message}`);
  if (issues.length > 0) {
    parts.push(`Avoid these problems found in the previous attempt:\n${issues.join('\n')}`);
  }

  if (note && note.trim()) {
    parts.push(`Teacher note: ${note.trim()}`);
  }

  // A set with neither instructions nor topics, whose rejected items carry no issues
  // and which the teacher regenerated without a note, would otherwise compose to the
  // empty string and 400 at the generator.
  if (parts.length === 0) {
    return 'Replace these sentences with new ones testing the same material.';
  }

  return parts.join('\n\n');
}
