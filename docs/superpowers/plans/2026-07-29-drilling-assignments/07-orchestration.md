# Track D — Generation Orchestration (Wave 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn a teacher's sentence into a validated, reviewable set — bank first, AI for the shortfall, deterministic checks before the model, progress the teacher can watch.

**Service:** `speakasap/education-service` · **Depends on:** Tracks A, A2, B, C · **Blocks:** Track F

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contracts C2–C6), spec §7.1, §7.3, §10.

**You own:** `education-service/src/drills/orchestration/**` only. Track B owns everything else under `src/drills/`; import from it, do not modify it.

---

### Task D.1: Service clients

**Files:**
- Create: `education-service/src/drills/orchestration/content.client.ts`
- Create: `education-service/src/drills/orchestration/ai.client.ts`
- Test: `education-service/src/drills/orchestration/content.client.spec.ts`

**Interfaces:**
- Produces:
  - `ContentClient.searchItems(req: DrillItemSearchRequest): Promise<DrillItemSearchResponse>`
  - `ContentClient.getBaseline(courseKey, languageCode, maxLessonOrder): Promise<VocabularyBaseline>`
  - `ContentClient.getTopics(languageCode, materialLanguage): Promise<DrillTopicDTO[]>`
  - `ContentClient.createSet(input): Promise<DrillSetDetailDTO>`
  - `ContentClient.replaceSetItems(setUuid, positions, items): Promise<DrillSetDetailDTO>`
  - `AiClient.generate(req: GenerateDrillRequest): Promise<GenerateDrillResponse>`
  - `AiClient.validate(req: ValidateDrillRequest): Promise<ValidateDrillResponse>`

- [ ] **Step 1: Write the failing test**

```ts
import { ContentClient } from './content.client';

describe('ContentClient', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock as any;
    process.env.CONTENT_SERVICE_URL = 'http://content:4201';
  });

  it('forwards the caller bearer token', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], totalAvailable: 0 }) });
    await new ContentClient().searchItems(
      { languageCode: 'de', materialLanguage: 'ru', topicSlugs: [], limit: 5 },
      'tok-1',
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1');
  });

  it('throws ServiceUnavailable rather than returning an empty result on 500', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    await expect(new ContentClient().searchItems(
      { languageCode: 'de', materialLanguage: 'ru', topicSlugs: [], limit: 5 }, 'tok',
    )).rejects.toThrow(/content-service/i);
  });

  it('times out rather than hanging the generation job', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    process.env.DRILL_CLIENT_TIMEOUT_MS = '50';
    await expect(new ContentClient().searchItems(
      { languageCode: 'de', materialLanguage: 'ru', topicSlugs: [], limit: 5 }, 'tok',
    )).rejects.toThrow();
  });
});
```

The second test matters: a client that swallows a 500 and returns `[]` turns a
content-service outage into "the bank has no items", and the orchestrator then
silently generates 50 AI items nobody asked for.

- [ ] **Step 2: Run, confirm failure. Implement both clients**

Use `AbortController` with `DRILL_CLIENT_TIMEOUT_MS` (default 30000 for content,
180000 for AI — generation is slow by nature). Every non-ok response throws
`ServiceUnavailableException` naming the upstream service.

- [ ] **Step 3: Run, confirm PASS. Commit**

---

### Task D.2: Deterministic pre-checks

Runs before the validator agent. Cheap, and rejects most bad output for free.

**Files:**
- Create: `education-service/src/drills/orchestration/pre-checks.ts`
- Create: `education-service/src/drills/orchestration/closed-lists.ts`
- Test: `education-service/src/drills/orchestration/pre-checks.spec.ts`

**Interfaces:**
- Consumes: `parseTemplate` (copy of Track A's `template.ts` — see step 1), `checkVocabularyRatio`
- Produces: `runPreChecks(items, ctx): PreCheckResult[]` where
  ```ts
  export interface PreCheckResult { itemRef: number; issues: ValidationIssue[]; fatal: boolean; }
  ```
  `fatal` means "discard, do not send to the validator".

- [ ] **Step 1: Import the parser rather than rewriting it**

`parseTemplate` and `hashItem` live in content-service. education-service cannot
import across services, so copy `template.ts` verbatim into
`education-service/src/drills/orchestration/template.ts` and add a test asserting
the two files are byte-identical:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

it('template.ts matches the content-service original', () => {
  const here = readFileSync(join(__dirname, 'template.ts'), 'utf8');
  const there = readFileSync(
    join(__dirname, '../../../../content-service/src/drills/template.ts'), 'utf8');
  expect(here).toBe(there);
});
```

Duplication with a drift test beats two subtly different parsers producing two
different hashes for the same sentence.

- [ ] **Step 2: Write the closed lists**

```ts
/** Topics where the answer must be drawn from a fixed set. The strongest
 *  possible topic-alignment check, and it costs nothing. */
export const CLOSED_LISTS: Record<string, Record<string, ReadonlySet<string>>> = {
  de: {
    prepositions: new Set(['an','auf','aus','bei','bis','durch','für','gegen','hinter','in',
      'mit','nach','neben','ohne','seit','über','um','unter','von','vor','während','wegen','zu','zwischen']),
    articles: new Set(['der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines']),
  },
  en: {
    prepositions: new Set(['about','above','across','after','against','among','around','at','before',
      'behind','below','beside','between','by','down','during','for','from','in','inside','into','near',
      'of','off','on','onto','out','outside','over','since','through','to','toward','under','until',
      'up','upon','with','within','without']),
    articles: new Set(['a','an','the']),
  },
};

export function closedListFor(languageCode: string, topicSlug: string): ReadonlySet<string> | null {
  return CLOSED_LISTS[languageCode]?.[topicSlug] ?? null;
}
```

- [ ] **Step 3: Write the failing test**

```ts
import { runPreChecks } from './pre-checks';

const ctx = {
  languageCode: 'de', materialLanguage: 'ru',
  topicSlugs: ['prepositions'],
  baseline: { courseKey: 'c', languageCode: 'de', maxLessonOrder: 5,
              words: [], index: ['bus','schule','warte','gehe','die','den'] },
  existingHashes: new Set<string>(),
};

const item = (template: string, blanks: any[]) => ({ template, blanks, hint: null });

describe('runPreChecks', () => {
  it('passes a clean preposition item', () => {
    const r = runPreChecks([item('Ich warte [на]{auf} den Bus.',
      [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }])], ctx);
    expect(r[0].issues).toEqual([]);
    expect(r[0].fatal).toBe(false);
  });

  it('flags a blank count mismatch as fatal', () => {
    const r = runPreChecks([item('Ich warte [на]{auf} den [x]{Bus}.',
      [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }])], ctx);
    expect(r[0].issues[0].code).toBe('BLANK_COUNT_MISMATCH');
    expect(r[0].fatal).toBe(true);
  });

  it('flags an empty answer as fatal', () => {
    const r = runPreChecks([item('Ich warte []{} den Bus.',
      [{ index: 0, prompt: '', answer: '', alternatives: [] }])], ctx);
    expect(r[0].issues.some((i) => i.code === 'EMPTY_ANSWER')).toBe(true);
    expect(r[0].fatal).toBe(true);
  });

  it('flags a Cyrillic answer in a German drill as fatal', () => {
    const r = runPreChecks([item('Ich warte [на]{на} den Bus.',
      [{ index: 0, prompt: 'на', answer: 'на', alternatives: [] }])], ctx);
    expect(r[0].issues.some((i) => i.code === 'WRONG_SCRIPT')).toBe(true);
    expect(r[0].fatal).toBe(true);
  });

  it('flags an off-list answer for a closed-list topic, NOT fatal', () => {
    const r = runPreChecks([item('Ich sehe [die]{die} Schule.',
      [{ index: 0, prompt: 'die', answer: 'die', alternatives: [] }])], ctx);
    expect(r[0].issues.some((i) => i.code === 'CLOSED_LIST_MISMATCH')).toBe(true);
    expect(r[0].fatal).toBe(false);
  });

  it('flags a duplicate against existing hashes as fatal', () => {
    const withHash = { ...ctx, existingHashes: new Set([
      require('./template').hashItem('Ich warte auf den Bus.', 'de')]) };
    const r = runPreChecks([item('Ich warte [на]{auf} den Bus.',
      [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }])], withHash);
    expect(r[0].issues.some((i) => i.code === 'DUPLICATE')).toBe(true);
    expect(r[0].fatal).toBe(true);
  });

  it('flags a vocabulary breach across the batch, NOT fatal per item', () => {
    const r = runPreChecks([
      item('Ich [x]{auf} exotisch fremdartig ungewöhnlich.',
        [{ index: 0, prompt: 'x', answer: 'auf', alternatives: [] }]),
    ], ctx);
    expect(r[0].issues.some((i) => i.code === 'VOCABULARY_RATIO')).toBe(true);
    expect(r[0].fatal).toBe(false);
  });
});
```

The fatal/non-fatal split matters. Fatal means structurally unusable — discard
silently and regenerate. Non-fatal means "a human should look" — keep the item,
show the teacher the issue.

- [ ] **Step 4: Run, confirm failure. Implement**

Script detection: build a per-language expected-script test using Unicode
property escapes — `/\p{Script=Latin}/u` for de/en/fr/es/it/nl/pt/sv/da/no/pl/cs/tr,
`/\p{Script=Cyrillic}/u` for ru, `/\p{Script=Greek}/u` for el. An answer whose
letters are *entirely* in the wrong script is `WRONG_SCRIPT`; mixed is allowed
(loanwords, proper nouns).

- [ ] **Step 5: Run, confirm PASS (7 passed + 1 drift test). Commit**

---

### Task D.3: The generation pipeline

**Files:**
- Create: `education-service/src/drills/orchestration/generation.service.ts`
- Test: `education-service/src/drills/orchestration/generation.service.spec.ts`

**Interfaces:**
- Produces: `GenerationService.run(job: GenerationJob): Promise<void>` — updates `generationProgress` as it goes, and the set's `reviewState` at the end.

- [ ] **Step 1: Write the failing tests — the three shapes of a run**

```ts
describe('GenerationService.run', () => {
  it('makes ZERO AI calls when the bank covers the request, and auto-approves', async () => {
    content.searchItems.mockResolvedValue({
      items: Array.from({ length: 50 }, (_, i) => bankItem(i)), totalAvailable: 80,
    });
    await svc.run(job({ itemCount: 50 }));
    expect(ai.generate).not.toHaveBeenCalled();
    expect(content.createSet).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'BANK', reviewState: 'APPROVED' }),
    );
  });

  it('asks the AI for exactly the shortfall', async () => {
    content.searchItems.mockResolvedValue({
      items: Array.from({ length: 18 }, (_, i) => bankItem(i)), totalAvailable: 18,
    });
    ai.generate.mockResolvedValue({ items: [], meta: {} });
    await svc.run(job({ itemCount: 50 }));
    expect(ai.generate.mock.calls[0][0].count).toBe(32);
  });

  it('passes the vocabulary baseline and the avoid list to the AI', async () => {
    content.searchItems.mockResolvedValue({ items: [bankItem(0)], totalAvailable: 1 });
    ai.generate.mockResolvedValue({ items: [], meta: {} });
    await svc.run(job({ itemCount: 5 }));
    const req = ai.generate.mock.calls[0][0];
    expect(req.knownVocabulary).toEqual(expect.arrayContaining(['bus', 'schule']));
    expect(req.avoidTexts).toContain('Ich gehe in die Schule.');
    expect(req.maxNewWordsPerSentence).toBe(2);
  });

  it('generates the whole set for a topic with no bank coverage', async () => {
    content.searchItems.mockResolvedValue({ items: [], totalAvailable: 0 });
    ai.generate.mockResolvedValue({ items: [aiItem()], meta: {} });
    ai.validate.mockResolvedValue({ results: [{ itemRef: 0, state: 'PASS', issues: [], suggestedFix: null }], meta: {} });
    await svc.run(job({ itemCount: 1, topicSlugs: ['brand-new-topic'] }));
    expect(ai.generate.mock.calls[0][0].count).toBe(1);
    expect(content.createSet).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'AI', reviewState: 'PENDING_REVIEW' }),
    );
  });

  it('retries at most twice when validation discards items, then marks partial', async () => {
    content.searchItems.mockResolvedValue({ items: [], totalAvailable: 0 });
    ai.generate.mockResolvedValue({ items: [aiItem('bad')], meta: {} });
    ai.validate.mockResolvedValue({ results: [], meta: {} });
    preChecks.mockReturnValue([{ itemRef: 0, issues: [{ code: 'EMPTY_ANSWER' }], fatal: true }]);
    await svc.run(job({ itemCount: 10 }));
    expect(ai.generate).toHaveBeenCalledTimes(3);
    expect(content.createSet).toHaveBeenCalledWith(
      expect.objectContaining({ partial: true }),
    );
  });

  it('validates BANK items too, not only AI items', async () => {
    content.searchItems.mockResolvedValue({ items: [bankItem(0)], totalAvailable: 1 });
    ai.validate.mockResolvedValue({ results: [{ itemRef: 0, state: 'PASS', issues: [], suggestedFix: null }], meta: {} });
    await svc.run(job({ itemCount: 1 }));
    expect(ai.validate).toHaveBeenCalled();
    expect(ai.validate.mock.calls[0][0].items).toHaveLength(1);
  });

  it('advances generationProgress through every phase in order', async () => {
    content.searchItems.mockResolvedValue({ items: [bankItem(0)], totalAvailable: 1 });
    ai.validate.mockResolvedValue({ results: [{ itemRef: 0, state: 'PASS', issues: [], suggestedFix: null }], meta: {} });
    await svc.run(job({ itemCount: 1 }));
    const phases = progressUpdates.map((p) => p.phase);
    expect(phases).toEqual(['RESOLVING', 'BANK', 'VALIDATING', 'READY']);
  });

  it('sets phase FAILED and a readable message when the AI call throws', async () => {
    content.searchItems.mockResolvedValue({ items: [], totalAvailable: 0 });
    ai.generate.mockRejectedValue(new Error('upstream 502'));
    await svc.run(job({ itemCount: 5 }));
    const last = progressUpdates[progressUpdates.length - 1];
    expect(last.phase).toBe('FAILED');
    expect(last.message).toMatch(/502|unavailable/i);
  });
});
```

The last-but-one test is the spec's "validate every item including bank items"
rule, and it is the one most likely to be quietly dropped for being expensive.
Do not drop it.

- [ ] **Step 2: Run, confirm failure. Implement**

Pipeline order, matching spec §10.1: `RESOLVING` (topics + student course +
lesson order) → `BANK` (search, filtered by baseline) → `GENERATING` (only when
short) → `VALIDATING` (pre-checks, then the agent, over **all** items) →
`READY`. Progress is persisted on the assignment row after every phase and after
every 5 generated items.

Set `origin`: `BANK` when no AI item survives, `AI` when no bank item is used,
`MIXED` otherwise. `reviewState` is `APPROVED` only when `origin === 'BANK'`.

- [ ] **Step 3: Run, confirm PASS (8 passed). Commit**

---

### Task D.4: The regeneration loop

**Files:**
- Create: `education-service/src/drills/orchestration/regeneration.service.ts`
- Test: `education-service/src/drills/orchestration/regeneration.service.spec.ts`

**Interfaces:**
- Produces: `RegenerationService.regenerate(setUuid, itemIds: number[], note?: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
describe('RegenerationService.regenerate', () => {
  it('asks for exactly as many items as were rejected', async () => {
    await svc.regenerate('s-1', [3, 7, 11]);
    expect(ai.generate.mock.calls[0][0].count).toBe(3);
  });

  it('replaces items in place, preserving their order values', async () => {
    await svc.regenerate('s-1', [3, 7, 11]);
    const call = content.replaceSetItems.mock.calls[0];
    expect(call[1]).toEqual([3, 7, 11]);
  });

  it('feeds the validation issues back into the generation request', async () => {
    setDetail.items = [{ id: 3, order: 3, validationIssues: [
      { code: 'OFF_TOPIC', message: 'Blank tests an article, not a preposition' }] }];
    await svc.regenerate('s-1', [3]);
    expect(ai.generate.mock.calls[0][0].instructions)
      .toContain('Blank tests an article, not a preposition');
  });

  it('adds the teacher note to the instructions when supplied', async () => {
    await svc.regenerate('s-1', [3], 'make them shorter');
    expect(ai.generate.mock.calls[0][0].instructions).toContain('make them shorter');
  });

  it('avoids every other sentence already in the set', async () => {
    setDetail.items = [
      { id: 3, order: 3, item: { plainText: 'A' } },
      { id: 4, order: 4, item: { plainText: 'B' } },
    ];
    await svc.regenerate('s-1', [3]);
    expect(ai.generate.mock.calls[0][0].avoidTexts).toContain('B');
    expect(ai.generate.mock.calls[0][0].avoidTexts).not.toContain('A');
  });

  it('writes the replaced items to DrillItemRevision before overwriting', async () => {
    await svc.regenerate('s-1', [3]);
    expect(content.replaceSetItems.mock.calls[0][3])
      .toMatchObject({ recordRevisionReason: 'REGENERATED' });
  });

  it('returns the set to PENDING_REVIEW even if it was APPROVED', async () => {
    setDetail.reviewState = 'APPROVED';
    await svc.regenerate('s-1', [3]);
    expect(content.updateSet).toHaveBeenCalledWith('s-1',
      expect.objectContaining({ reviewState: 'PENDING_REVIEW' }));
  });

  it('has no iteration limit — a fourth round behaves like the first', async () => {
    for (let i = 0; i < 4; i++) await svc.regenerate('s-1', [3]);
    expect(ai.generate).toHaveBeenCalledTimes(4);
  });
});
```

- [ ] **Step 2: Run, confirm failure. Implement. Run, confirm PASS (8 passed). Commit**

---

### Task D.5: Job runner, progress and the stale sweep

**Files:**
- Create: `education-service/src/drills/orchestration/job-runner.service.ts`
- Test: `education-service/src/drills/orchestration/job-runner.service.spec.ts`

**Interfaces:**
- Produces: `JobRunner.enqueue(assignmentUuids: string[], job: GenerationJob): void` (fire-and-forget), `JobRunner.sweepStale(): Promise<number>`

- [ ] **Step 1: Write the failing test**

```ts
describe('JobRunner', () => {
  it('returns immediately without awaiting the pipeline', async () => {
    generation.run.mockImplementation(() => new Promise(() => {}));
    const t0 = Date.now();
    runner.enqueue(['a-1'], job());
    expect(Date.now() - t0).toBeLessThan(50);
  });

  it('records FAILED progress when the pipeline rejects, and never rethrows', async () => {
    generation.run.mockRejectedValue(new Error('boom'));
    expect(() => runner.enqueue(['a-1'], job())).not.toThrow();
    await flushPromises();
    expect(repo.updateProgress).toHaveBeenCalledWith('a-1',
      expect.objectContaining({ phase: 'FAILED' }));
  });

  it('marks a job stalled once it passes its estimate without progressing', async () => {
    const p = runner.progressFor('a-1', { startedAt: Date.now() - 200_000, etaSeconds: 60,
      lastProgressAt: Date.now() - 200_000, phase: 'GENERATING', generated: 3, total: 50 });
    expect(p.stalled).toBe(true);
  });

  it('does not report stalled while items are still arriving', async () => {
    const p = runner.progressFor('a-1', { startedAt: Date.now() - 200_000, etaSeconds: 60,
      lastProgressAt: Date.now() - 1_000, phase: 'GENERATING', generated: 30, total: 50 });
    expect(p.stalled).toBe(false);
  });

  it('sweeps GENERATING rows older than the timeout to CANCELLED', async () => {
    process.env.DRILL_GENERATION_TIMEOUT_SECONDS = '600';
    repo.findStaleGenerating.mockResolvedValue([{ uuid: 'a-old' }]);
    const n = await runner.sweepStale();
    expect(n).toBe(1);
    expect(repo.cancel).toHaveBeenCalledWith('a-old', expect.stringMatching(/timed out/i));
  });
});
```

Test 4 is the "never count down to zero and lie" rule from spec §10.3: elapsed
time alone does not mean stalled; lack of *progress* does.

- [ ] **Step 2: Implement. Run, confirm PASS (5 passed)**

`sweepStale` is invoked lazily from `GET /drill-assignments/:uuid` and from the
teacher list endpoint, not by a scheduler — there is no scheduler in this
service and adding one is out of scope.

- [ ] **Step 3: Wire the module, run the full suite, typecheck, commit**

```bash
cd /home/ssf/Documents/Github/speakasap/education-service
rtk npm test && rtk npm run typecheck
rtk git add src/drills/orchestration/
rtk git commit -m "feat(education): generation orchestration

Bank first, AI for the shortfall, deterministic pre-checks before the
validator, and every item validated including bank items. Progress is
persisted per phase; a job reports stalled on lack of progress rather
than on elapsed time.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track D completion checklist

- [ ] `rtk npm test` green, `rtk npm run typecheck` clean
- [ ] The template.ts drift test passes
- [ ] Bank-covers-request makes zero AI calls — tested
- [ ] Bank items are validated too — tested
- [ ] Status file at `status/track-d.md`
