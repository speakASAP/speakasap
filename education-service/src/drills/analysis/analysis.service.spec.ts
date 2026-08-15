import { Logger } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

const assignment = {
  uuid: 'a1',
  studentId: 7,
  languageCode: 'en',
  materialLanguage: 'ru',
  items: [
    {
      uuid: 'i1',
      order: 0,
      template: 'We will have to walk {{0}} this market.',
      blanks: [{ index: 0, answer: 'through', prompt: 'через' }],
    },
    {
      uuid: 'i2',
      order: 1,
      template: 'Get {{0}} your car immediately!',
      blanks: [{ index: 0, answer: 'out of', prompt: 'из' }],
    },
  ],
};

const attempts = [
  { itemUuid: 'i1', blankIndex: 0, submittedValue: 'across', isCorrect: false, revealed: false, attemptNo: 1 },
  { itemUuid: 'i2', blankIndex: 0, submittedValue: 'out', isCorrect: false, revealed: false, attemptNo: 1 },
];

function deps(overrides: Record<string, any> = {}) {
  const repo = {
    createRun: jest.fn(async () => 'run-1'),
    markRunning: jest.fn(async () => undefined),
    markReady: jest.fn(async () => undefined),
    markNoErrors: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
    replaceClusters: jest.fn(async () => undefined),
    ...overrides.repo,
  };

  const client = {
    analyze: jest.fn(async () => ({
      clusters: [
        {
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'through — сквозь',
          rules: [],
          examples: [],
          answers: ['through', 'out of'],
        },
      ],
    })),
    ...overrides.client,
  };

  const taxonomy = {
    slugsFor: jest.fn(async () => ['en.prepositions-of-movement', 'en.other']),
    fallbackSlug: (lang: string) => `${lang}.other`,
    coerceSlug: (candidate: string, allowed: string[], lang: string) =>
      allowed.includes(candidate)
        ? { slug: candidate, coerced: false }
        : { slug: `${lang}.other`, coerced: true },
    ...overrides.taxonomy,
  };

  const prisma: any = {
    drillAssignment: {
      findUnique: jest.fn(async () => overrides.assignment ?? assignment),
    },
    drillAttempt: {
      findMany: jest.fn(async () => overrides.attempts ?? attempts),
    },
  };

  return { repo, client, taxonomy, prisma };
}

describe('AnalysisService.run', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('marks the run NO_ERRORS and never calls the model when nothing was wrong', async () => {
    const d = deps({ attempts: [
      { itemUuid: 'i1', blankIndex: 0, submittedValue: 'through', isCorrect: true, revealed: false, attemptNo: 1 },
    ] });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.markNoErrors).toHaveBeenCalledWith('run-1');
    expect(d.client.analyze).not.toHaveBeenCalled();
    expect(d.repo.markFailed).not.toHaveBeenCalled();
  });

  it('sends every failed blank to the analyzer with the allowed slugs', async () => {
    const d = deps();
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const sent = d.client.analyze.mock.calls[0][0];
    expect(sent.failures).toHaveLength(2);
    expect(sent.allowedTopicSlugs).toEqual(['en.prepositions-of-movement', 'en.other']);
    expect(sent.materialLanguage).toBe('ru');
    expect(sent.correlationId).toBe('cid-1');
  });

  it('persists the clusters and marks the run READY', async () => {
    const d = deps();
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.replaceClusters).toHaveBeenCalled();
    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    expect(clusters).toHaveLength(1);
    expect(clusters[0].failedAnswers.map((a: any) => a.answer).sort()).toEqual(['out of', 'through']);
    expect(d.repo.markReady).toHaveBeenCalledWith('run-1');
  });

  it('sums mistakeCount across distinct blanks that normalize to the same answer, without duplicating the entry', async () => {
    // Two DIFFERENT items both blank on "through" — 2 wrong attempts on i1, 1 on i2.
    // The persisted cluster must hold ONE "through" entry with mistakeCount 2+1=3, not
    // two separate entries: this sum is what later decides how many remedial sentences
    // the word earns, so a bug here would quietly under- or over-drill the student.
    const twoBlankAssignment = {
      uuid: 'a1',
      studentId: 7,
      languageCode: 'en',
      materialLanguage: 'ru',
      items: [
        {
          uuid: 'i1',
          order: 0,
          template: 'We will have to walk {{0}} this market.',
          blanks: [{ index: 0, answer: 'through', prompt: 'через' }],
        },
        {
          uuid: 'i2',
          order: 1,
          template: 'The train goes {{0}} the tunnel.',
          blanks: [{ index: 0, answer: 'through', prompt: 'через' }],
        },
      ],
    };
    const twoBlankAttempts = [
      { itemUuid: 'i1', blankIndex: 0, submittedValue: 'across', isCorrect: false, revealed: false, attemptNo: 1 },
      { itemUuid: 'i1', blankIndex: 0, submittedValue: 'over', isCorrect: false, revealed: false, attemptNo: 2 },
      { itemUuid: 'i1', blankIndex: 0, submittedValue: 'through', isCorrect: true, revealed: false, attemptNo: 3 },
      { itemUuid: 'i2', blankIndex: 0, submittedValue: 'along', isCorrect: false, revealed: false, attemptNo: 1 },
      { itemUuid: 'i2', blankIndex: 0, submittedValue: 'through', isCorrect: true, revealed: false, attemptNo: 2 },
    ];

    const d = deps({
      assignment: twoBlankAssignment,
      attempts: twoBlankAttempts,
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            {
              topicSlug: 'en.prepositions-of-movement',
              title: 't',
              explanation: 'e',
              rules: [],
              examples: [],
              answers: ['through'],
            },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    expect(clusters).toHaveLength(1);
    const throughEntries = clusters[0].failedAnswers.filter((a: any) => a.answer === 'through');
    expect(throughEntries).toHaveLength(1);
    expect(throughEntries[0].mistakeCount).toBe(3);
  });

  it('coerces an out-of-taxonomy slug to the language fallback', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.invented', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through', 'out of'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.replaceClusters.mock.calls[0][5][0].topicSlug).toBe('en.other');
  });

  it('files an answer no cluster claimed under the fallback rather than dropping it', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.prepositions-of-movement', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    const answers = clusters.flatMap((c: any) => c.failedAnswers.map((a: any) => a.answer));
    expect(answers.sort()).toEqual(['out of', 'through']);
    expect(clusters.some((c: any) => c.topicSlug === 'en.other')).toBe(true);
  });

  it('never puts one answer in two clusters', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.prepositions-of-movement', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through', 'out of'] },
            { topicSlug: 'en.other', title: 't2', explanation: 'e2', rules: [], examples: [], answers: ['through'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    const answers = clusters.flatMap((c: any) => c.failedAnswers.map((a: any) => a.answer));
    expect(answers).toHaveLength(new Set(answers).size);
  });

  it('drops a cluster left with no answers after attribution', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.prepositions-of-movement', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through', 'out of'] },
            { topicSlug: 'en.other', title: 'empty', explanation: 'e', rules: [], examples: [], answers: ['not-a-real-answer'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    expect(clusters.every((c: any) => c.failedAnswers.length > 0)).toBe(true);
  });

  it('marks the run FAILED when the analyzer throws, and does not throw itself', async () => {
    const d = deps({ client: { analyze: jest.fn(async () => { throw new Error('502 Bad Gateway'); }) } });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await expect(service.run('a1', 'cid-1')).resolves.toBeUndefined();

    expect(d.repo.markFailed).toHaveBeenCalledWith('run-1', expect.stringContaining('502'));
    expect(d.repo.markReady).not.toHaveBeenCalled();
  });

  it('marks the run FAILED when the taxonomy is missing for the language', async () => {
    const d = deps({
      taxonomy: { slugsFor: jest.fn(async () => { throw new Error('No grammar taxonomy seeded for language "fr"'); }) },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.markFailed).toHaveBeenCalledWith('run-1', expect.stringContaining('taxonomy'));
  });

  // No run row can exist for an assignment that is gone: createRun needs its studentId,
  // and DrillAnalysisRun.studentId is a required column. The failure is visible in the
  // error log rather than on a row — this is the one path with nothing to mark.
  it('logs and gives up when the assignment has vanished, without creating a run row', async () => {
    const d = deps();
    d.prisma.drillAssignment.findUnique = jest.fn(async () => null);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await expect(service.run('a1', 'cid-1')).resolves.toBeUndefined();

    expect(d.repo.createRun).not.toHaveBeenCalled();
    expect(d.repo.markFailed).not.toHaveBeenCalled();
    expect(d.client.analyze).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('a1'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('cid-1'));
  });

  it('marks RUNNING before calling the analyzer', async () => {
    const d = deps();
    const order: string[] = [];
    d.repo.markRunning = jest.fn(async () => { order.push('running'); });
    d.client.analyze = jest.fn(async () => { order.push('analyze'); return { clusters: [] }; });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(order).toEqual(['running', 'analyze']);
  });
});

/**
 * German attribution — the regression that produced an empty `de.other` card in production.
 *
 * German is in `CASE_SENSITIVE_LANGUAGES`, so the grading normalizer preserves case. The
 * model writes the article in running prose ("die"), not in the stored surface form
 * ("Die"), so a case-sensitive match dropped every answer into the fallback bucket and the
 * student was shown a card with no title, explanation, rules or examples.
 *
 * The data below is assignment 6320c263-bbab-4bed-85e7-6891fbf52bb6 as it actually was.
 */
describe('AnalysisService.run — German case-sensitive attribution', () => {
  const germanAssignment = {
    uuid: 'de-1',
    studentId: 7,
    languageCode: 'de',
    materialLanguage: 'ru',
    items: [
      { uuid: 'g1', order: 0, template: '{{0}} Haus ist groß.', blanks: [{ index: 0, answer: 'Das', prompt: 'это' }] },
      { uuid: 'g2', order: 1, template: 'Ich sehe {{0}} Hund.', blanks: [{ index: 0, answer: 'den', prompt: 'этот' }] },
      { uuid: 'g3', order: 2, template: '{{0}} Frau ist hier.', blanks: [{ index: 0, answer: 'Die', prompt: 'это' }] },
    ],
  };

  const germanAttempts = [
    { itemUuid: 'g1', blankIndex: 0, submittedValue: 'die', isCorrect: false, revealed: false, attemptNo: 1 },
    { itemUuid: 'g2', blankIndex: 0, submittedValue: 'diese', isCorrect: false, revealed: false, attemptNo: 1 },
    { itemUuid: 'g3', blankIndex: 0, submittedValue: 'Das', isCorrect: false, revealed: false, attemptNo: 1 },
  ];

  function germanDeps(modelAnswers: string[]) {
    const d = deps({ assignment: germanAssignment, attempts: germanAttempts });
    d.taxonomy.slugsFor = jest.fn(async () => ['de.articles-and-gender', 'de.other']);
    d.client.analyze = jest.fn(async () => ({
      clusters: [
        {
          topicSlug: 'de.articles-and-gender',
          title: 'Артикли и род',
          explanation: 'Род существительного определяет артикль.',
          rules: ['das Haus — средний род'],
          examples: [{ text: 'Das Haus ist groß.', gloss: 'Дом большой.' }],
          answers: modelAnswers,
        },
      ],
    }));
    return d;
  }

  it('attributes answers the model echoed in lowercase to the real grammar cluster', async () => {
    // The model writes "das"/"die" mid-sentence; the stored answers are "Das"/"Die".
    const d = germanDeps(['das', 'den', 'die']);
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('de-1', 'cid-de');

    expect(d.repo.markFailed).not.toHaveBeenCalled();
    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    expect(clusters).toHaveLength(1);
    expect(clusters[0].topicSlug).toBe('de.articles-and-gender');
    expect(clusters[0].explanation).not.toBe('');
    expect(clusters[0].failedAnswers.map((a: any) => a.answer).sort()).toEqual(['Das', 'Die', 'den']);
  });

  it('still prefers an exact-case match over a case-folded one', async () => {
    const d = germanDeps(['Das', 'den', 'Die']);
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('de-1', 'cid-de');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    expect(clusters[0].failedAnswers).toHaveLength(3);
  });

  it('fails the run rather than storing an explanation-free card when nothing matches', async () => {
    // The model described a completely different drill. Storing this would render as a
    // titleless card with a bare word list — the exact production symptom.
    const d = germanDeps(['völlig', 'andere', 'wörter']);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('de-1', 'cid-de');

    expect(d.repo.replaceClusters).not.toHaveBeenCalled();
    expect(d.repo.markReady).not.toHaveBeenCalled();
    expect(d.repo.markFailed).toHaveBeenCalledWith('run-1', expect.stringContaining('attributed none'));
  });

  it('gives the fallback bucket a real title when only some answers are unclaimed', async () => {
    const d = germanDeps(['das', 'die']);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('de-1', 'cid-de');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    const fallback = clusters.find((c: any) => c.topicSlug === 'de.other');
    expect(fallback.failedAnswers.map((a: any) => a.answer)).toEqual(['den']);
    expect(fallback.title).not.toBe('');
    expect(fallback.explanation).not.toBe('');
  });
});
