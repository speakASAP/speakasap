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

    await svc.run(job({ itemCount: 10 }));

    expect(ai.generate).toHaveBeenCalledTimes(3);
    expect(svc.lastRunSummary()?.partial).toBe(true);
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

    await svc.run(job({ itemCount: 10 }));

    expect(svc.lastRunSummary()?.itemsKept).toBe(0);
    expect(svc.lastRunSummary()?.reviewState).not.toBe('APPROVED');
    expect(content.createSet).toHaveBeenCalledWith(
      expect.objectContaining({ reviewState: 'PENDING_REVIEW' }),
      'tok',
    );
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
