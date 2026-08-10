import { GenerationService, GenerationJob, ProgressSink } from './generation.service';
import { DrillItemDTO } from '../contracts';

const bankItem = (i: number): DrillItemDTO => ({
  id: 100 + i,
  languageCode: 'de',
  materialLanguage: 'ru',
  topicSlug: 'prepositions',
  level: 'A1',
  template: `Ich gehe [в]{in} die Schule${i === 0 ? '' : ` ${i}`}.`,
  blanks: [{ index: 0, prompt: 'в', answer: 'in', alternatives: [] }],
  hint: null,
  sourceType: 'BANK_GRAMMAR',
  courseKey: 'de-a1',
  lessonOrder: 1,
  unknownWords: [],
  hash: `bank-hash-${i}`,
});

const aiItem = (answer = 'auf') => ({
  template: `Ich warte [на]{${answer}} den Bus.`,
  blanks: [{ index: 0, prompt: 'на', answer, alternatives: [] }],
  hint: null,
  topicSlug: 'prepositions',
  newWords: [],
});

const baseline = {
  courseKey: 'de-a1',
  languageCode: 'de',
  maxLessonOrder: 3,
  words: [],
  index: ['bus', 'schule', 'warte', 'gehe'],
  hasBaseline: true,
};

const passResult = (itemRef: number) => ({
  itemRef,
  state: 'PASS' as const,
  issues: [],
  suggestedFix: null,
});

describe('GenerationService.run', () => {
  let content: any;
  let ai: any;
  let progressUpdates: any[];
  let sink: ProgressSink;
  let svc: GenerationService;

  const job = (over: Partial<GenerationJob> = {}): GenerationJob => ({
    setUuid: 'set-1',
    assignmentUuids: ['a-1'],
    languageCode: 'de',
    materialLanguage: 'ru',
    languageId: 1,
    level: 'A1',
    topicSlugs: ['prepositions'],
    topics: [{ slug: 'prepositions', title: 'Prepositions' }],
    instructions: 'Practise dative prepositions',
    itemCount: 10,
    courseKey: 'de-a1',
    maxLessonOrder: 3,
    teacherId: 7,
    title: 'Prepositions practice',
    token: 'tok',
    correlationId: 'corr-1',
    ...over,
  });

  beforeEach(() => {
    progressUpdates = [];
    sink = { update: jest.fn(async (_uuids: string[], p: any) => { progressUpdates.push(p); }) };
    content = {
      searchItems: jest.fn().mockResolvedValue({ items: [], totalAvailable: 0 }),
      getBaseline: jest.fn().mockResolvedValue(baseline),
      getTopics: jest.fn().mockResolvedValue([]),
      createSet: jest.fn().mockResolvedValue({ uuid: 'set-1' }),
    };
    ai = {
      generate: jest.fn().mockResolvedValue({ items: [], meta: {} }),
      validate: jest.fn().mockResolvedValue({ results: [], meta: {} }),
    };
    svc = new GenerationService(content, ai, sink);
  });

  it('makes ZERO AI calls for generation when the bank covers the request, and auto-approves', async () => {
    content.searchItems.mockResolvedValue({
      items: Array.from({ length: 50 }, (_, i) => bankItem(i)),
      totalAvailable: 80,
    });
    ai.validate.mockResolvedValue({
      results: Array.from({ length: 50 }, (_, i) => passResult(i)),
      meta: {},
    });

    await svc.run(job({ itemCount: 50 }));

    expect(ai.generate).not.toHaveBeenCalled();
    expect(content.createSet).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'BANK', reviewState: 'APPROVED' }),
      'tok',
    );
  });

  it('asks the AI for exactly the shortfall', async () => {
    content.searchItems.mockResolvedValue({
      items: Array.from({ length: 18 }, (_, i) => bankItem(i)),
      totalAvailable: 18,
    });

    await svc.run(job({ itemCount: 50 }));

    expect(ai.generate.mock.calls[0][0].count).toBe(32);
  });

  it('passes the vocabulary baseline and the avoid list to the AI', async () => {
    content.searchItems.mockResolvedValue({ items: [bankItem(0)], totalAvailable: 1 });

    await svc.run(job({ itemCount: 5 }));

    const req = ai.generate.mock.calls[0][0];
    expect(req.knownVocabulary).toEqual(expect.arrayContaining(['bus', 'schule']));
    expect(req.avoidTexts).toContain('Ich gehe in die Schule.');
    expect(req.maxNewWordsPerSentence).toBe(2);
  });

  it('generates the whole set for a topic with no bank coverage', async () => {
    content.searchItems.mockResolvedValue({ items: [], totalAvailable: 0 });
    ai.generate.mockResolvedValue({ items: [aiItem()], meta: {} });
    ai.validate.mockResolvedValue({ results: [passResult(0)], meta: {} });

    await svc.run(job({ itemCount: 1, topicSlugs: ['brand-new-topic'] }));

    expect(ai.generate.mock.calls[0][0].count).toBe(1);
    expect(content.createSet).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'AI', reviewState: 'PENDING_REVIEW' }),
      'tok',
    );
  });

  it('retries at most twice when every item is discarded, then records a partial set', async () => {
    content.searchItems.mockResolvedValue({ items: [], totalAvailable: 0 });
    // An empty answer — runPreChecks rejects it as fatal without any AI validation.
    ai.generate.mockResolvedValue({
      items: [{ template: 'Ich warte []{} den Bus.', blanks: [{ index: 0, prompt: '', answer: '', alternatives: [] }], hint: null, topicSlug: 'prepositions', newWords: [] }],
      meta: {},
    });

    // Still retries the full three times before giving up; it just no longer calls a
    // run that kept nothing a success. See "reports FAILED, not READY".
    await svc.run(job({ itemCount: 10 }));

    expect(ai.generate).toHaveBeenCalledTimes(3);
  });

  // Found by reading the run logs, not by a test: a run that kept nothing scored
  // aiKept === 0 and therefore origin BANK, which auto-approves. APPROVED is what makes
  // a set visible to a student, so an empty set would have shipped past the teacher's
  // review queue entirely.
  it('never auto-approves a set that kept no items', async () => {
    content.searchItems.mockResolvedValue({ items: [], totalAvailable: 0 });
    ai.generate.mockResolvedValue({
      items: [{ template: 'Ich warte []{} den Bus.', blanks: [{ index: 0, prompt: '', answer: '', alternatives: [] }], hint: null, topicSlug: 'prepositions', newWords: [] }],
      meta: {},
    });

    // The intent stands — a run that kept nothing must never be approved — but the set
    // is no longer created at all: an empty set in a review queue is indistinguishable
    // from a finished one, which is exactly how this reached production.
    await svc.run(job({ itemCount: 10 }));

    expect(content.createSet).not.toHaveBeenCalled();
    expect(svc.lastRunSummary()?.reviewState).not.toBe('APPROVED');
  });

  // The spec's "validate every item including bank items" rule. It is the one most
  // likely to be quietly dropped for being expensive — a bank item was validated when
  // it entered the bank, but not against THIS teacher's instructions and topic.
  it('validates BANK items too, not only AI items', async () => {
    content.searchItems.mockResolvedValue({ items: [bankItem(0)], totalAvailable: 1 });
    ai.validate.mockResolvedValue({ results: [passResult(0)], meta: {} });

    await svc.run(job({ itemCount: 1 }));

    expect(ai.validate).toHaveBeenCalled();
    expect(ai.validate.mock.calls[0][0].items).toHaveLength(1);
  });

  it('advances generationProgress through every phase in order', async () => {
    content.searchItems.mockResolvedValue({ items: [bankItem(0)], totalAvailable: 1 });
    ai.validate.mockResolvedValue({ results: [passResult(0)], meta: {} });

    await svc.run(job({ itemCount: 1 }));

    expect(progressUpdates.map((p) => p.phase)).toEqual([
      'RESOLVING',
      'BANK',
      'VALIDATING',
      'READY',
    ]);
  });

  it('sets phase FAILED and a readable message when the AI call throws', async () => {
    content.searchItems.mockResolvedValue({ items: [], totalAvailable: 0 });
    ai.generate.mockRejectedValue(new Error('upstream 502'));

    await svc.run(job({ itemCount: 5 }));

    const last = progressUpdates[progressUpdates.length - 1];
    expect(last.phase).toBe('FAILED');
    expect(last.message).toMatch(/502|unavailable/i);
  });

  // A failed run must not leave a half-built set behind for a teacher to approve.
  it('creates no set when the run fails', async () => {
    content.searchItems.mockRejectedValue(new Error('content-service responded 500'));

    await svc.run(job({ itemCount: 5 }));

    expect(content.createSet).not.toHaveBeenCalled();
    expect(progressUpdates[progressUpdates.length - 1].phase).toBe('FAILED');
  });

  // MIXED is the common case and the easiest to get wrong: an origin of BANK would
  // auto-approve AI sentences no human has ever read.
  it('marks a set MIXED and PENDING_REVIEW when both bank and AI items survive', async () => {
    content.searchItems.mockResolvedValue({ items: [bankItem(0)], totalAvailable: 1 });
    ai.generate.mockResolvedValue({ items: [aiItem()], meta: {} });
    ai.validate.mockResolvedValue({ results: [passResult(0), passResult(1)], meta: {} });

    await svc.run(job({ itemCount: 2 }));

    expect(content.createSet).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'MIXED', reviewState: 'PENDING_REVIEW' }),
      'tok',
    );
  });

  // Items the validator marks FAIL are discarded. Keeping them because the count was
  // short is how an ungrammatical sentence reaches a student.
  it('drops items the validator marks FAIL', async () => {
    content.searchItems.mockResolvedValue({ items: [], totalAvailable: 0 });
    ai.generate.mockResolvedValue({ items: [aiItem('auf'), aiItem('unter')], meta: {} });
    ai.validate.mockResolvedValue({
      results: [
        passResult(0),
        { itemRef: 1, state: 'FAIL' as const, issues: [{ code: 'UNGRAMMATICAL' as const, message: 'no' }], suggestedFix: null },
      ],
      meta: {},
    });

    await svc.run(job({ itemCount: 2 }));

    expect(svc.lastRunSummary()?.itemsKept).toBe(1);
  });

  // The bank search must be constrained by the student's progress, or the set contains
  // sentences from lessons the student has not reached.
  it('constrains the bank search to the student lesson ceiling and the baseline', async () => {
    await svc.run(job({ itemCount: 5 }));

    const req = content.searchItems.mock.calls[0][0];
    expect(req.maxLessonOrder).toBe(3);
    expect(req.courseKey).toBe('de-a1');
    expect(req.vocabularyBaseline).toEqual(expect.arrayContaining(['bus', 'schule']));
  });

  // Requesting the exact shortfall means one bad item leaves the set short. The AI is
  // asked for the shortfall only; over-requesting would be a silent cost multiplier on
  // every run, so this pins the deliberate choice.
  it('requests the shortfall without padding', async () => {
    content.searchItems.mockResolvedValue({
      items: Array.from({ length: 8 }, (_, i) => bankItem(i)),
      totalAvailable: 8,
    });

    await svc.run(job({ itemCount: 10 }));

    expect(ai.generate.mock.calls[0][0].count).toBe(2);
  });
});

/**
 * The set arrived empty in production while the pipeline reported READY: only
 * `itemIds` was sent, `bankItemId` exists on bank candidates alone, and nothing
 * created a row for AI output. The sentences were paid for and discarded.
 *
 * These tests pin the persistence, which the suite above never asserted — every
 * one of them passed with the defect present.
 */
describe('GenerationService — AI items must reach content-service', () => {
  let content: any;
  let ai: any;
  let progress: ProgressSink;
  let svc: GenerationService;

  const job = (over: Partial<GenerationJob> = {}): GenerationJob =>
    ({
      setUuid: 'set-1',
      assignmentUuids: ['a-1'],
      languageCode: 'de',
      materialLanguage: 'ru',
      languageId: 3,
      level: 'A1',
      topicSlugs: ['prepositions'],
      topics: [{ slug: 'prepositions', title: 'Prepositions' }],
      instructions: 'dative',
      itemCount: 1,
      courseKey: 'de-a1',
      maxLessonOrder: 3,
      teacherId: 7,
      title: 'T',
      token: 'tok',
      correlationId: 'corr-1',
      ...over,
    }) as GenerationJob;

  beforeEach(() => {
    content = {
      searchItems: jest.fn().mockResolvedValue({ items: [], totalAvailable: 0 }),
      getBaseline: jest.fn().mockResolvedValue(null),
      getTopics: jest.fn().mockResolvedValue([]),
      createSet: jest.fn().mockResolvedValue({ uuid: 'set-1' }),
    };
    ai = {
      generate: jest.fn().mockResolvedValue({ items: [aiItem()], meta: {} }),
      validate: jest.fn().mockResolvedValue({
        results: [{ itemRef: 0, state: 'PASS', issues: [], suggestedFix: null }],
        meta: {},
      }),
    };
    progress = { update: jest.fn() };
    svc = new GenerationService(content, ai, progress);
  });

  it('sends the generated sentence, not just an empty itemIds array', async () => {
    await svc.run(job());

    const input = content.createSet.mock.calls[0][0];
    expect(input.newItems).toHaveLength(1);
    expect(input.newItems[0].template).toBe('Ich warte [на]{auf} den Bus.');
  });

  it('sends the blanks with it, or the item is unanswerable', async () => {
    await svc.run(job());

    const [blank] = content.createSet.mock.calls[0][0].newItems[0].blanks;
    expect(blank).toMatchObject({ index: 0, answer: 'auf' });
  });

  it('carries a topic slug so the created row is filed somewhere', async () => {
    await svc.run(job());

    expect(content.createSet.mock.calls[0][0].newItems[0].topicSlug).toBe('prepositions');
  });

  // The model may omit the slug. Filing the item under nothing loses it to every
  // future bank search, so the requested topic stands in.
  it('falls back to the requested topic when the model omits one', async () => {
    ai.generate.mockResolvedValue({ items: [{ ...aiItem(), topicSlug: '' }], meta: {} });

    await svc.run(job({ topicSlugs: ['past-tense'] }));

    expect(content.createSet.mock.calls[0][0].newItems[0].topicSlug).toBe('past-tense');
  });

  it('sends no newItems for a pure bank set', async () => {
    content.searchItems.mockResolvedValue({ items: [bankItem(0)], totalAvailable: 1 });
    ai.generate.mockResolvedValue({ items: [], meta: {} });

    await svc.run(job());

    const input = content.createSet.mock.calls[0][0];
    expect(input.newItems).toEqual([]);
    expect(input.itemIds).toEqual([100]);
    expect(ai.generate).not.toHaveBeenCalled();
  });

  // The count the teacher is shown must match what the set actually contains.
  it('sends as many items as it reports generating', async () => {
    ai.generate.mockResolvedValue({
      items: [aiItem('auf'), aiItem('an')],
      meta: {},
    });
    ai.validate.mockResolvedValue({
      results: [
        { itemRef: 0, state: 'PASS', issues: [], suggestedFix: null },
        { itemRef: 1, state: 'PASS', issues: [], suggestedFix: null },
      ],
      meta: {},
    });

    await svc.run(job({ itemCount: 2 }));

    const input = content.createSet.mock.calls[0][0];
    expect(input.itemIds.length + input.newItems.length).toBe(svc.lastRunSummary()!.itemsKept);
  });

  /**
   * A teacher who typed instructions but picked no topic got an empty set and a cheerful
   * "Ready with 0 of 5 requested item(s)". content-service requires `topicSlugs` to be an
   * array — empty is explicitly allowed — and a missing key is not an array: JSON.stringify
   * drops undefined entirely, so the bank search 400'd on the very first phase.
   *
   * The whole run then produced nothing while reporting success, because a failed bank
   * search is not fatal on its own: with no bank items and no topics the model had
   * nothing to work from either.
   */
  it('always sends topicSlugs as an array, even when the teacher picked no topic', async () => {
    await svc.run(job({ topicSlugs: undefined as any }));

    const sent = content.searchItems.mock.calls[0][0];
    expect(Array.isArray(sent.topicSlugs)).toBe(true);
    expect(sent.topicSlugs).toEqual([]);
  });

  it('passes the teacher topics through when there are some', async () => {
    await svc.run(job({ topicSlugs: ['present-perfect'] }));

    expect(content.searchItems.mock.calls[0][0].topicSlugs).toEqual(['present-perfect']);
  });

  /**
   * "Ready with 0 of 5 requested item(s)" — reported as success, with an empty set in the
   * teacher's review queue that looked exactly like a finished one. Zero items is not a
   * partial result, it is a failed run, and it must say so.
   */
  it('reports FAILED, not READY, when nothing survived', async () => {
    content.searchItems.mockResolvedValue({ items: [], totalAvailable: 0 });
    ai.generate.mockResolvedValue({ items: [], meta: {} });
    ai.validate.mockResolvedValue({ results: [], meta: {} });

    await svc.run(job());

    const phases = (progress.update as jest.Mock).mock.calls.map((c: any[]) => c[1].phase);
    expect(phases).toContain('FAILED');
    expect(phases).not.toContain('READY');
  });

  it('does not create an empty set for a teacher to review', async () => {
    content.searchItems.mockResolvedValue({ items: [], totalAvailable: 0 });
    ai.generate.mockResolvedValue({ items: [], meta: {} });
    ai.validate.mockResolvedValue({ results: [], meta: {} });

    await svc.run(job());

    expect(content.createSet).not.toHaveBeenCalled();
  });

  /**
   * ai-microservice's DTO requires a non-empty `correlationId`, and nothing in the
   * pipeline ever set one — every generate call 400'd, so no run could ever produce an
   * item. The AI client spec passed one by hand, which is why the gap survived: it tested
   * the client's behaviour given a correlationId, never that the caller supplies it.
   */
  it('sends a correlationId with every AI call', async () => {
    await svc.run(job());

    expect(ai.generate.mock.calls[0][0].correlationId).toEqual(expect.any(String));
    expect(ai.generate.mock.calls[0][0].correlationId).not.toBe('');
  });

  it('uses the same correlationId for generate and validate, so one run is traceable', async () => {
    await svc.run(job());

    expect(ai.validate.mock.calls[0][0].correlationId).toBe(
      ai.generate.mock.calls[0][0].correlationId,
    );
  });
});

/**
 * Validation is sent in batches.
 *
 * One call carrying every candidate is the largest single request in the pipeline, and it
 * is what timed out in production on a 20-item set: `AI_HTTP_TIMEOUT` after 75s, twice
 * (2026-08-10). Generation itself scales linearly and is comfortably inside budget —
 * 5/10/20 items at 7.1/11.8/21.4s — so the batch limit exists for validation, where the
 * whole set travels at once.
 *
 * `itemRef` is an INDEX INTO THE BATCH, so a batch's results must be mapped back to
 * global positions before anything is discarded. Getting that wrong drops the wrong
 * sentences — silently, since every itemRef is still a valid index.
 */
describe('GenerationService.run — validation batching', () => {
  let content: any;
  let ai: any;
  let sink: any;
  let svc: GenerationService;

  const job = (over: Partial<GenerationJob> = {}): GenerationJob => ({
    setUuid: 'set-1',
    assignmentUuids: ['a-1'],
    languageId: 1,
    languageCode: 'de',
    materialLanguage: 'ru',
    level: 'A1',
    topics: [{ slug: 'prepositions', title: 'Prepositions' }],
    topicSlugs: ['prepositions'],
    instructions: 'Practise dative prepositions',
    itemCount: 20,
    courseKey: 'de-a1',
    maxLessonOrder: 3,
    teacherId: 7,
    title: 'Prepositions practice',
    token: 'tok',
    correlationId: 'corr-1',
    ...over,
  });

  beforeEach(() => {
    sink = { update: jest.fn(async () => undefined) };
    content = {
      searchItems: jest.fn().mockResolvedValue({ items: [], totalAvailable: 0 }),
      getBaseline: jest.fn().mockResolvedValue({ index: [], courseKey: 'de-a1' }),
      getTopics: jest.fn().mockResolvedValue([]),
      createSet: jest.fn().mockResolvedValue({ uuid: 'set-1' }),
    };
    ai = {
      generate: jest.fn().mockResolvedValue({ items: [], meta: {} }),
      // Every batch passes unless a test says otherwise.
      validate: jest.fn(async (req: any) => ({
        results: req.items.map((it: any) => ({
          itemRef: it.itemRef, state: 'PASS', issues: [], suggestedFix: null,
        })),
        meta: {},
      })),
    };
    svc = new GenerationService(content, ai, sink);
  });

  const withBank = (n: number) => {
    content.searchItems.mockResolvedValue({
      items: Array.from({ length: n }, (_, i) => bankItem(i)),
      totalAvailable: n,
    });
  };

  it('splits 20 candidates into batches instead of one 20-item call', async () => {
    withBank(20);

    await svc.run(job({ itemCount: 20 }));

    expect(ai.validate.mock.calls.length).toBeGreaterThan(1);
    for (const [req] of ai.validate.mock.calls) {
      expect(req.items.length).toBeLessThanOrEqual(10);
    }
  });

  it('sends every candidate exactly once across the batches', async () => {
    withBank(20);

    await svc.run(job({ itemCount: 20 }));

    const sent = ai.validate.mock.calls.flatMap(([req]: any[]) =>
      req.items.map((i: any) => i.template),
    );
    expect(sent).toHaveLength(20);
    expect(new Set(sent).size).toBe(20);
  });

  it('still makes a single call when the set fits in one batch', async () => {
    withBank(6);

    await svc.run(job({ itemCount: 6 }));

    expect(ai.validate).toHaveBeenCalledTimes(1);
  });

  /**
   * The index-mapping trap: `itemRef` is relative to its batch. A FAIL at itemRef 0 of
   * the SECOND batch must drop global item 10, not global item 0.
   */
  it('maps a batch-relative itemRef back to the right global item', async () => {
    withBank(20);
    ai.validate.mockImplementation(async (req: any) => ({
      results: req.items.map((it: any, i: number) => ({
        itemRef: it.itemRef,
        // Fail only the first item of any batch after the first.
        state: i === 0 && req.items[0].template.includes('10') ? 'FAIL' : 'PASS',
        issues: [], suggestedFix: null,
      })),
      meta: {},
    }));

    await svc.run(job({ itemCount: 20 }));

    const created = content.createSet.mock.calls[0][0];
    const kept = [...(created.itemIds ?? []), ...(created.newItems ?? [])];
    expect(kept).toHaveLength(19);
    // Item 10 is the one that failed; item 0 must have survived.
    expect(created.itemIds).toContain(100);
    expect(created.itemIds).not.toContain(110);
  });

  it('reports FAILED and creates no set when a batch fails', async () => {
    // A dropped batch would quietly shrink the set with no indication anything broke —
    // the same class of silent degradation this pipeline exists to avoid. `run` reports
    // FAILED rather than throwing (the caller is a queue consumer), so the contract is
    // "no set created, progress says FAILED", not a rejected promise.
    withBank(20);
    ai.validate
      .mockResolvedValueOnce({ results: [], meta: {} })
      .mockRejectedValueOnce(new Error('AI_HTTP_TIMEOUT'));

    await svc.run(job({ itemCount: 20 }));

    expect(content.createSet).not.toHaveBeenCalled();
    const phases = sink.update.mock.calls.map(([, p]: any[]) => p.phase);
    expect(phases).toContain('FAILED');
  });
});
