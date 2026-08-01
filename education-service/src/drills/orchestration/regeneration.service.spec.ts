import { RegenerationService, RegenerationJobContext } from './regeneration.service';

const aiItem = (answer = 'auf') => ({
  template: `Ich warte [на]{${answer}} den Bus.`,
  blanks: [{ index: 0, prompt: 'на', answer, alternatives: [] }],
  hint: null,
  topicSlug: 'prepositions',
  newWords: [],
});

const setItem = (id: number, order: number, plainText: string, issues: any[] = []) => ({
  id,
  order,
  validationState: 'FAIL',
  validationIssues: issues,
  validatedAt: null,
  item: {
    id,
    languageCode: 'de',
    materialLanguage: 'ru',
    topicSlug: 'prepositions',
    level: 'A1',
    template: plainText,
    blanks: [],
    hint: null,
    sourceType: 'AI',
    courseKey: 'de-a1',
    lessonOrder: 1,
    unknownWords: [],
    hash: `h-${id}`,
    plainText,
  },
});

describe('RegenerationService.regenerate', () => {
  let content: any;
  let ai: any;
  let setDetail: any;
  let svc: RegenerationService;

  const ctx = (): RegenerationJobContext => ({
    token: 'tok',
    correlationId: 'corr-r1',
    languageId: 1,
  });

  beforeEach(() => {
    setDetail = {
      uuid: 's-1',
      title: 'Prepositions',
      languageCode: 'de',
      materialLanguage: 'ru',
      level: 'A1',
      topicSlugs: ['prepositions'],
      courseKey: 'de-a1',
      lessonOrder: 3,
      origin: 'AI',
      reviewState: 'PENDING_REVIEW',
      instructions: 'Practise dative prepositions',
      items: [setItem(3, 3, 'A'), setItem(4, 4, 'B')],
    };
    content = {
      getSet: jest.fn(async () => setDetail),
      getBaseline: jest.fn().mockResolvedValue({
        courseKey: 'de-a1',
        languageCode: 'de',
        maxLessonOrder: 3,
        words: [],
        index: ['bus', 'schule', 'warte'],
        hasBaseline: true,
      }),
      replaceSetItems: jest.fn().mockResolvedValue(undefined),
      updateSet: jest.fn().mockResolvedValue(undefined),
    };
    ai = {
      generate: jest.fn(async (req: any) => ({
        items: Array.from({ length: req.count }, (_, i) => aiItem(i === 0 ? 'auf' : 'unter')),
        meta: {},
      })),
      validate: jest.fn(async (req: any) => ({
        results: req.items.map((it: any) => ({
          itemRef: it.itemRef,
          state: 'PASS',
          issues: [],
          suggestedFix: null,
        })),
        meta: {},
      })),
    };
    svc = new RegenerationService(content, ai);
  });

  it('asks for exactly as many items as were rejected', async () => {
    setDetail.items = [setItem(3, 3, 'A'), setItem(7, 7, 'B'), setItem(11, 11, 'C')];

    await svc.regenerate('s-1', [3, 7, 11], undefined, ctx());

    expect(ai.generate.mock.calls[0][0].count).toBe(3);
  });

  it('replaces items in place, preserving their order values', async () => {
    setDetail.items = [setItem(3, 3, 'A'), setItem(7, 7, 'B'), setItem(11, 11, 'C')];

    await svc.regenerate('s-1', [3, 7, 11], undefined, ctx());

    expect(content.replaceSetItems.mock.calls[0][1]).toEqual([3, 7, 11]);
  });

  it('feeds the validation issues back into the generation request', async () => {
    setDetail.items = [
      setItem(3, 3, 'A', [
        { code: 'OFF_TOPIC', message: 'Blank tests an article, not a preposition' },
      ]),
    ];

    await svc.regenerate('s-1', [3], undefined, ctx());

    expect(ai.generate.mock.calls[0][0].instructions).toContain(
      'Blank tests an article, not a preposition',
    );
  });

  it('adds the teacher note to the instructions when supplied', async () => {
    await svc.regenerate('s-1', [3], 'make them shorter', ctx());

    expect(ai.generate.mock.calls[0][0].instructions).toContain('make them shorter');
  });

  it('keeps the original teacher instructions in the regeneration request', async () => {
    await svc.regenerate('s-1', [3], 'make them shorter', ctx());

    expect(ai.generate.mock.calls[0][0].instructions).toContain('Practise dative prepositions');
  });

  it('avoids every other sentence already in the set', async () => {
    await svc.regenerate('s-1', [3], undefined, ctx());

    const req = ai.generate.mock.calls[0][0];
    expect(req.avoidTexts).toContain('B');
    expect(req.avoidTexts).not.toContain('A');
  });

  it('writes the replaced items to DrillItemRevision before overwriting', async () => {
    await svc.regenerate('s-1', [3], undefined, ctx());

    expect(content.replaceSetItems.mock.calls[0][3]).toMatchObject({
      recordRevisionReason: 'REGENERATED',
    });
  });

  it('returns the set to PENDING_REVIEW even if it was APPROVED', async () => {
    setDetail.reviewState = 'APPROVED';

    await svc.regenerate('s-1', [3], undefined, ctx());

    expect(content.updateSet).toHaveBeenCalledWith(
      's-1',
      expect.objectContaining({ reviewState: 'PENDING_REVIEW' }),
      'tok',
    );
  });

  it('has no iteration limit — a fourth round behaves like the first', async () => {
    for (let i = 0; i < 4; i++) {
      await svc.regenerate('s-1', [3], undefined, ctx());
    }

    expect(ai.generate).toHaveBeenCalledTimes(4);
  });

  // Regenerated items go through the same gates as first-round ones. Skipping them
  // because "the teacher asked for these" is how an ungrammatical replacement lands
  // in an already-reviewed set.
  it('validates the regenerated items', async () => {
    await svc.regenerate('s-1', [3], undefined, ctx());

    expect(ai.validate).toHaveBeenCalled();
    expect(ai.validate.mock.calls[0][0].items).toHaveLength(1);
  });

  it('drops a regenerated item the validator marks FAIL rather than replacing with it', async () => {
    ai.validate.mockResolvedValue({
      results: [{ itemRef: 0, state: 'FAIL', issues: [{ code: 'UNGRAMMATICAL', message: 'no' }], suggestedFix: null }],
      meta: {},
    });

    await svc.regenerate('s-1', [3], undefined, ctx());

    expect(content.replaceSetItems).not.toHaveBeenCalled();
  });

  // A regeneration that produced nothing usable must leave the set exactly as it was.
  // Blanking the rejected positions would silently shrink a set the teacher is mid-review on.
  it('leaves the set untouched when nothing survives', async () => {
    ai.generate.mockResolvedValue({ items: [], meta: {} });

    await svc.regenerate('s-1', [3], undefined, ctx());

    expect(content.replaceSetItems).not.toHaveBeenCalled();
    expect(content.updateSet).not.toHaveBeenCalled();
  });

  it('rejects an itemId that is not in the set rather than regenerating a stranger', async () => {
    await expect(svc.regenerate('s-1', [999], undefined, ctx())).rejects.toThrow(/999/);
    expect(ai.generate).not.toHaveBeenCalled();
  });
});
