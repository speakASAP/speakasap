import { Injectable, Logger } from '@nestjs/common';
import {
  CefrLevel,
  DrillBlank,
  DrillItemDTO,
  DrillSetOrigin,
  DrillSetReviewState,
  DrillTemplate,
  GenerationPhase,
  GenerationProgress,
  ItemValidationResult,
  VocabularyBaseline,
  VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE,
} from '../contracts';
import { parseTemplate } from '../template';
import { AiClient } from './ai.client';
import { ContentClient, CreateSetInput } from './content.client';
import { PreCheckItem, runPreChecks } from './pre-checks';

/** Everything the pipeline needs, resolved by the caller before the job is queued. */
export interface GenerationJob {
  setUuid: string;
  /** Assignments whose progress this run reports on. */
  assignmentUuids: string[];
  languageCode: string;
  materialLanguage: string;
  /** content-service's numeric language id, required by CreateSetInput. */
  languageId: number;
  level: CefrLevel | null;
  topicSlugs: string[];
  topics: { slug: string; title: string; focus?: string }[];
  /** The teacher's verbatim free-text request. */
  instructions: string;
  itemCount: number;
  courseKey: string | null;
  /** The student's lesson ceiling. Bank items beyond it are not theirs to see yet. */
  maxLessonOrder: number | null;
  teacherId: number | null;
  title: string;
  /** Caller's bearer token, forwarded to both upstreams. */
  token: string;
  correlationId: string;
}

export interface ProgressSink {
  update(assignmentUuids: string[], progress: GenerationProgress): Promise<void>;
}

export interface RunSummary {
  setUuid: string;
  origin: DrillSetOrigin;
  reviewState: DrillSetReviewState;
  itemsKept: number;
  bankItemsKept: number;
  aiItemsKept: number;
  /** True when the run finished short of `itemCount`. */
  partial: boolean;
  generateCalls: number;
}

/** A candidate item, before it is known whether it survives. */
interface Candidate extends PreCheckItem {
  source: 'BANK' | 'AI';
  /** Present for bank items only — content-service already has a row for them. */
  bankItemId?: number;
  /**
   * Present for AI items only. Carried through so the row content-service
   * creates can be filed under the right topic; a bank item already has one.
   */
  topicSlug?: string;
  plainText: string;
}

const MAX_GENERATION_ATTEMPTS = 3;
/**
 * Candidates per validation call.
 *
 * 10 keeps a batch near the measured 11.8s mark, comfortably inside the 75s per-attempt
 * budget even when the provider is slow, while keeping the number of round trips low. A
 * whole 20-item set in one call is what produced two consecutive 75s timeouts.
 */
const VALIDATION_BATCH_SIZE = Number(process.env.DRILL_VALIDATION_BATCH_SIZE) || 10;

/**
 * The generation pipeline, spec §10.1.
 *
 * RESOLVING -> BANK -> GENERATING (only when short) -> VALIDATING -> READY.
 *
 * Bank first: a bank item is free, already human-reviewed and already known to fit the
 * course vocabulary. The AI is asked only for the shortfall, without padding — padding
 * would be a silent cost multiplier on every run.
 *
 * Every surviving item is validated, bank items included. They were validated when they
 * entered the bank, but not against THIS teacher's instructions and topic, which is what
 * the validator is being asked about here.
 */
@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private summary: RunSummary | null = null;

  constructor(
    private readonly content: ContentClient,
    private readonly ai: AiClient,
    private readonly progress: ProgressSink,
  ) {}

  /** The last completed run. Exposed for the job runner and for assertions. */
  lastRunSummary(): RunSummary | null {
    return this.summary;
  }

  async run(job: GenerationJob): Promise<void> {
    const started = Date.now();
    this.summary = null;
    let generateCalls = 0;

    this.logger.log(
      `Generation start: set=${job.setUuid} assignments=${job.assignmentUuids.length} requested=${job.itemCount} lang=${job.languageCode}/${job.materialLanguage} topics=${(job.topics ?? []).length}`,
    );

    try {
      await this.report(job, 'RESOLVING', 0, job.itemCount, 'Resolving topics and student progress');
      const baseline = await this.resolveBaseline(job);

      await this.report(job, 'BANK', 0, job.itemCount, 'Searching the drill bank');
      const bank = await this.content.searchItems(
        {
          languageCode: job.languageCode,
          materialLanguage: job.materialLanguage,
          // Always an array. content-service requires the key and explicitly allows it
          // to be empty; `undefined` is not an array, and JSON.stringify drops the key
          // entirely, so a teacher who picked no topic got a 400 on the first phase and
          // an empty set reported as "Ready with 0 of N".
          topicSlugs: job.topicSlugs ?? [],
          level: job.level ?? undefined,
          courseKey: job.courseKey ?? undefined,
          maxLessonOrder: job.maxLessonOrder ?? undefined,
          vocabularyBaseline: baseline?.index,
          limit: job.itemCount,
        },
        job.token,
      );

      const candidates: Candidate[] = bank.items.map((item) => toBankCandidate(item));
      const seenHashes = new Set<string>(bank.items.map((i) => i.hash));
      // The bank covering the request is the cheap path and looks identical to a stall
      // from outside, so say how many it covered.
      this.logger.log(
        `Generation bank: set=${job.setUuid} reusable=${candidates.length}/${job.itemCount} shortfall=${Math.max(0, job.itemCount - candidates.length)}`,
      );

      // Only when short. A bank that covers the request costs nothing and needs no model.
      let attempt = 0;
      while (candidates.length < job.itemCount && attempt < MAX_GENERATION_ATTEMPTS) {
        const shortfall = job.itemCount - candidates.length;
        await this.report(
          job,
          'GENERATING',
          candidates.length,
          job.itemCount,
          `Generating ${shortfall} more item(s)`,
        );

        generateCalls++;
        this.logger.log(
          `Generation model call ${generateCalls}/${MAX_GENERATION_ATTEMPTS}: set=${job.setUuid} asking=${shortfall}`,
        );
        const generated = await this.ai.generate(
          {
            languageCode: job.languageCode,
            materialLanguage: job.materialLanguage,
            level: job.level,
            topics: job.topics,
            instructions: job.instructions,
            count: shortfall,
            knownVocabulary: baseline?.index ?? [],
            maxNewWordsPerSentence: VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE,
            exampleItems: candidates.slice(0, 3).map((c) => c.template),
            avoidTexts: candidates.map((c) => c.plainText),
            correlationId: job.correlationId,
          },
          job.token,
        );
        attempt++;

        // Deterministic checks first: they are free and reject most bad output before
        // the validator is paid for an opinion on it.
        const fresh: Candidate[] = generated.items.map((item) => ({
          source: 'AI',
          template: item.template,
          blanks: item.blanks,
          hint: item.hint,
          // Kept so content-service can file the created row under a topic. The
          // model is asked for one item per requested topic, but falls back to
          // the first requested slug rather than filing the item under nothing.
          topicSlug: item.topicSlug || job.topicSlugs[0] || '',
          plainText: parseTemplate(item.template).plainText,
        }));
        const preChecked = runPreChecks(fresh, {
          languageCode: job.languageCode,
          materialLanguage: job.materialLanguage,
          // Always an array. content-service requires the key and explicitly allows it
          // to be empty; `undefined` is not an array, and JSON.stringify drops the key
          // entirely, so a teacher who picked no topic got a 400 on the first phase and
          // an empty set reported as "Ready with 0 of N".
          topicSlugs: job.topicSlugs ?? [],
          baseline: baseline ?? undefined,
          existingHashes: seenHashes,
        });

        let kept = 0;
        preChecked.forEach((result, i) => {
          if (result.fatal) {
            return;
          }
          candidates.push(fresh[i]);
          kept++;
        });

        if (generated.items.length === 0) {
          // The model returned nothing; retrying with an identical request will return
          // nothing again. Stop rather than burn two more calls.
          break;
        }
        this.logger.log(
          `Generation attempt ${attempt}: requested=${shortfall} returned=${generated.items.length} kept=${kept}`,
        );
      }

      await this.report(job, 'VALIDATING', candidates.length, job.itemCount, 'Validating items');
      const survivors = await this.validate(job, candidates);

      // Zero survivors is a failure, not a partial success. Reporting READY put an empty
      // set in the teacher's review queue that looked identical to a finished one, and
      // hid whatever actually went wrong — a 400 on the bank search, in the case that
      // produced this. Thrown before the set is created, so nothing empty is persisted;
      // the catch below reports FAILED.
      if (survivors.length === 0) {
        throw new Error(
          `Generation produced no items for set ${job.setUuid} (requested ${job.itemCount})`,
        );
      }

      const bankKept = survivors.filter((c) => c.source === 'BANK').length;
      const aiKept = survivors.length - bankKept;
      const origin = originFor(bankKept, aiKept);

      // APPROVED only for a pure bank set: every item in it has already been read by a
      // human. One surviving AI sentence means a teacher must look before a student does.
      const reviewState: DrillSetReviewState = origin === 'BANK' ? 'APPROVED' : 'PENDING_REVIEW';
      const partial = survivors.length < job.itemCount;

      const input: CreateSetInput = {
        uuid: job.setUuid,
        title: job.title,
        languageId: job.languageId,
        materialLanguage: job.materialLanguage,
        level: job.level,
        topicSlugs: job.topicSlugs,
        courseKey: job.courseKey,
        lessonOrder: job.maxLessonOrder,
        origin,
        reviewState,
        createdByTeacherId: job.teacherId,
        instructions: job.instructions,
        knownWordRatio: null,
        // Bank items are attached by id — content-service already holds them.
        itemIds: survivors.map((c) => c.bankItemId).filter((id): id is number => typeof id === 'number'),
        // AI items have no row anywhere yet, so they travel whole and
        // content-service creates them inside the same transaction as the set.
        //
        // Sending only `itemIds` was the defect that made every generated set
        // arrive empty: `bankItemId` exists on bank candidates alone, so the
        // filter above discarded every AI item and an all-AI set was created
        // with no items at all, while the pipeline reported READY. The
        // sentences had already been paid for.
        newItems: survivors
          .filter((c) => c.source === 'AI')
          .map((c) => ({
            template: c.template,
            blanks: c.blanks,
            hint: c.hint,
            topicSlug: c.topicSlug ?? '',
          })),
      };
      await this.content.createSet(input, job.token);

      this.summary = {
        setUuid: job.setUuid,
        origin,
        reviewState,
        itemsKept: survivors.length,
        bankItemsKept: bankKept,
        aiItemsKept: aiKept,
        partial,
        generateCalls,
      };

      await this.report(
        job,
        'READY',
        survivors.length,
        job.itemCount,
        partial
          ? `Ready with ${survivors.length} of ${job.itemCount} requested item(s)`
          : 'Ready',
      );
      this.logger.log(
        `Generation complete: set=${job.setUuid} origin=${origin} kept=${survivors.length}/${job.itemCount} generateCalls=${generateCalls} latencyMs=${Date.now() - started}`,
      );
    } catch (error) {
      // Deliberately does NOT create a partial set on failure: a half-built set sitting
      // in a teacher's review queue looks exactly like a finished one.
      const message = (error as Error).message || 'Generation failed';
      // Stack included: the message alone ("Request failed with status 500") does not say
      // which upstream produced it, and this is the one place the whole run can fail.
      this.logger.error(
        `Generation failed: set=${job.setUuid} generateCalls=${generateCalls} latencyMs=${Date.now() - started} — ${message}`,
        (error as Error).stack,
      );
      await this.report(job, 'FAILED', 0, job.itemCount, message);
    }
  }

  /**
   * Sends every candidate — bank and AI alike — to the validator, and keeps those it
   * does not FAIL. WARN survives: it is the teacher's call, and that is what the review
   * queue is for.
   */
  private async validate(job: GenerationJob, candidates: Candidate[]): Promise<Candidate[]> {
    if (candidates.length === 0) {
      return [];
    }

    // Sent in batches. One call carrying the whole set is the largest single request in
    // the pipeline, and it is what timed out in production: AI_HTTP_TIMEOUT after 75s,
    // twice, on a 20-item set (2026-08-10). Generation itself is not the problem — it
    // scales linearly and stays well inside budget (5/10/20 items at 7.1/11.8/21.4s) —
    // so the limit belongs here, where every candidate travels at once.
    //
    // Sequential, not parallel: firing five concurrent model calls to dodge a latency
    // problem trades a timeout for a rate limit, and the retry in LlmClient already
    // absorbs a single slow batch.
    const failed = new Set<number>();

    for (let offset = 0; offset < candidates.length; offset += VALIDATION_BATCH_SIZE) {
      const batch = candidates.slice(offset, offset + VALIDATION_BATCH_SIZE);

      this.logger.log(
        `Validation batch: set=${job.setUuid} items=${batch.length} ` +
          `offset=${offset}/${candidates.length}`,
      );

      const response = await this.ai.validate(
        {
          languageCode: job.languageCode,
          materialLanguage: job.materialLanguage,
          level: job.level,
          topics: job.topics,
          instructions: job.instructions,
          // itemRef is an index INTO THIS BATCH, so the response is mapped back to the
          // global position below. Sending the global index instead would be simpler but
          // hands the model a number that does not match the list it was given.
          items: batch.map((c, itemRef) => ({
            itemRef,
            template: c.template,
            blanks: c.blanks,
            hint: c.hint,
          })),
          correlationId: job.correlationId,
        },
        job.token,
      );

      for (const result of response.results as ItemValidationResult[]) {
        if (result.state !== 'FAIL') {
          continue;
        }
        // Batch-relative -> global. Out-of-range refs are ignored rather than trusted:
        // a bad index would otherwise discard an unrelated sentence.
        const globalIndex = offset + result.itemRef;
        if (result.itemRef >= 0 && result.itemRef < batch.length) {
          failed.add(globalIndex);
        } else {
          this.logger.warn(
            `Validation returned itemRef ${result.itemRef} outside batch of ` +
              `${batch.length} (set=${job.setUuid} offset=${offset}); ignoring it`,
          );
        }
      }
    }

    return candidates.filter((_c, i) => !failed.has(i));
  }

  /**
   * A course with no key has no baseline to fetch. A baseline lookup that fails is NOT
   * swallowed — it propagates, because generating against "the student knows nothing"
   * produces a set of sentences nobody can read.
   */
  private async resolveBaseline(job: GenerationJob): Promise<VocabularyBaseline | null> {
    if (!job.courseKey || job.maxLessonOrder === null) {
      return null;
    }
    return this.content.getBaseline(job.courseKey, job.languageCode, job.maxLessonOrder, job.token);
  }

  private async report(
    job: GenerationJob,
    phase: GenerationPhase,
    generated: number,
    total: number,
    message: string,
  ): Promise<void> {
    // Logged on every transition, not only at the end: a run that hangs leaves its last
    // phase in the log, which is the only way to tell "stuck resolving the bank" from
    // "stuck waiting on the model". Progress lives in a JSON column that a later phase
    // overwrites, so without this the previous phases are unrecoverable.
    this.logger.log(
      `Generation phase=${phase} set=${job.setUuid} assignments=${job.assignmentUuids.length} ${generated}/${total} — ${message}`,
    );
    await this.progress.update(job.assignmentUuids, {
      phase,
      generated,
      total,
      etaSeconds: null,
      message,
      stalled: false,
    });
  }
}

function toBankCandidate(item: DrillItemDTO): Candidate {
  return {
    source: 'BANK',
    bankItemId: item.id,
    template: item.template,
    blanks: item.blanks as DrillBlank[],
    hint: item.hint,
    plainText: parseTemplate(item.template as DrillTemplate).plainText,
  };
}

function originFor(bankKept: number, aiKept: number): DrillSetOrigin {
  // An empty set is not a bank set. Falling through to 'BANK' here would auto-approve
  // a set with nothing in it — APPROVED is what makes a set visible to a student, so a
  // failed run would ship an empty drill straight past the teacher's review queue.
  if (bankKept === 0 && aiKept === 0) return 'AI';
  if (aiKept === 0) return 'BANK';
  if (bankKept === 0) return 'AI';
  return 'MIXED';
}
