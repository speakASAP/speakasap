# Track C — Generator and Validator Agents (Wave 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Two independent AI agents — one that writes drill sentences, one that judges them.

**Service:** `ai-microservice` · **Depends on:** Track 0 · **Blocks:** Track D

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contracts C1, C5), spec §7 and §10.2.

**You own:** `ai-microservice/src/teacher-assistant/**`. Nothing else.

**Good news:** ai-microservice already has jest, ts-jest and `@nestjs/testing`. No test setup needed here.

**Design rule you must not break:** the validator is an *independent* check. It receives only the items and the original request — never the generator's prompt, reasoning, or any signal that an item was AI-generated. A validator that knows what the generator was trying to do will rubber-stamp it.

---

### Task C.1: Module scaffold and the LLM client wrapper

**Files:**
- Create: `ai-microservice/src/teacher-assistant/teacher-assistant.module.ts`
- Create: `ai-microservice/src/teacher-assistant/llm.client.ts`
- Test: `ai-microservice/src/teacher-assistant/llm.client.spec.ts`
- Modify: `ai-microservice/src/app.module.ts`

**Interfaces:**
- Consumes: the existing `/ai/complete` orchestrator endpoint
- Produces: `LlmClient.completeJson<T>(args): Promise<{ data: T; meta: LlmMeta }>` where
  ```ts
  export interface LlmMeta { model: string; tier: string; promptTokens: number; completionTokens: number; }
  ```
  Both agents use it. It is the only place that talks to `/ai/complete`.

- [ ] **Step 1: Write the failing test**

```ts
import { LlmClient } from './llm.client';
import { JwtUtil } from '../service-identity/jwt.util';
import {
  AiCompleteResponse,
  AiCompleteResponseSchema,
} from '../contracts/ai-complete.contract';

// Every fixture goes through the REAL response schema. This is the load-bearing
// part of the rewrite: hand-written mocks are what let a client that failed 100%
// of real requests ship with five green tests.
function aiCompleteResponse(overrides: Record<string, unknown> = {}): AiCompleteResponse {
  return AiCompleteResponseSchema.parse({ text: '', model_used: 'test-model', ...overrides });
}
function okResponse(overrides: Record<string, unknown> = {}) {
  return { ok: true, status: 200, json: async () => aiCompleteResponse(overrides) };
}

const TEST_SECRET = 'test-jwt-secret-not-a-real-credential';

describe('LlmClient.completeJson', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.AI_ORCHESTRATOR_URL = 'http://ai-microservice:3380';
    process.env.DRILL_GENERATION_MODEL_TIER = 'smart';
    process.env.JWT_SECRET = TEST_SECRET;
  });

  const call = (client: LlmClient, outputSchema: unknown = { type: 'object' }) =>
    client.completeJson<Record<string, unknown>>({
      systemPrompt: 'sys', userPrompt: 'user', outputSchema, correlationId: 'c-1',
    });
  const lastInit = () => fetchMock.mock.calls[0][1] as RequestInit;

  it('sends a service token that ServiceAuthGuard would accept', async () => {
    fetchMock.mockResolvedValue(okResponse({ text: '{"items":[]}' }));
    await call(new LlmClient());
    const headers = lastInit().headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer \S+$/);
    // Verified exactly the way the guard does it.
    const payload = JwtUtil.verify(headers.Authorization.slice(7), TEST_SECRET);
    expect(payload.serviceId).toBe('ai-microservice');
  });

  it('fails closed rather than calling unauthenticated when JWT_SECRET is absent', async () => {
    delete process.env.JWT_SECRET;
    await expect(call(new LlmClient())).rejects.toThrow(/auth is not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('parses the JSON body out of the contract `text` field', async () => {
    fetchMock.mockResolvedValue(okResponse({ text: '{"items":[{"template":"a"}]}' }));
    const { data } = await call(new LlmClient());
    expect((data as any).items[0].template).toBe('a');
  });

  it('maps model_used / inputTokens / outputTokens into meta', async () => {
    fetchMock.mockResolvedValue(okResponse({
      text: '{"items":[]}', model_used: 'anthropic/claude-sonnet-4',
      inputTokens: 1234, outputTokens: 567,
    }));
    const { meta } = await call(new LlmClient());
    expect(meta).toEqual({
      model: 'anthropic/claude-sonnet-4', tier: 'smart',
      promptTokens: 1234, completionTokens: 567,
    });
  });

  it('serializes the output schema into the outgoing user_prompt', async () => {
    fetchMock.mockResolvedValue(okResponse({ text: '{"items":[]}' }));
    const schema = { type: 'object', required: ['items'] };
    await call(new LlmClient(), schema);
    const body = JSON.parse(lastInit().body as string);
    expect(body.user_prompt).toContain(JSON.stringify(schema));
    expect(body.output_schema).toEqual(schema); // still triggers JSON mode upstream
  });

  it('throws when a 200 response carries an error_code', async () => {
    fetchMock.mockResolvedValue(okResponse({ text: '', error_code: 'RATE_LIMIT' }));
    await expect(call(new LlmClient())).rejects.toThrow(/RATE_LIMIT/);
  });

  it('bounds the upstream call with an abort signal', async () => {
    fetchMock.mockResolvedValue(okResponse({ text: '{"items":[]}' }));
    await call(new LlmClient());
    expect(lastInit().signal).toBeInstanceOf(AbortSignal);
  });

  it('throws on a non-ok upstream response without echoing the body', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 502, text: async () => 'bad gateway: leaky-detail-from-provider',
    });
    await expect(call(new LlmClient())).rejects.toThrow(/502/);
    await expect(call(new LlmClient())).rejects.not.toThrow(/leaky-detail/);
  });
});
```

The shipped spec also covers fence stripping, unparseable text, and the
top-level-spread fallback — see
`ai-microservice/src/teacher-assistant/llm.client.spec.ts` for the full list (13
cases). The fence-stripping and unparseable cases are not hypothetical — models
return both regularly, and a client that returns garbage on them pushes the
failure into the validator where it is much harder to diagnose.

- [ ] **Step 2: Run, confirm failure**

```bash
rtk npm --prefix /home/ssf/Documents/Github/ai-microservice test -- llm.client
```

- [ ] **Step 3: Implement**

```ts
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { JwtUtil } from '../service-identity/jwt.util';
import { AiCompleteResponse } from '../contracts/ai-complete.contract';

export interface LlmMeta {
  model: string;
  tier: string;
  promptTokens: number;
  completionTokens: number;
}

export interface CompleteJsonArgs {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: unknown;
  correlationId: string;
  maxTokens?: number;
}

const FENCE = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/;

/** `/ai/complete` runs behind ServiceAuthGuard (APP_GUARD in
 *  ServiceIdentityModule) and AiController has no `@Public()`. The guard
 *  verifies HS256 against `JWT_SECRET` and JwtUtil.verify pins `iss` to
 *  `ai-microservice`, so this service mints its own token with the same util. */
const SELF_SERVICE_ID = 'ai-microservice';
const SERVICE_TOKEN_TTL_SECONDS = 900;

/** Generous on purpose: a 50-item generate on the claude-CLI path is minutes. */
const DEFAULT_TIMEOUT_MS = 300_000;

/** Keys belonging to the `/ai/complete` envelope. Anything else at the top level
 *  came from AiService's `{ ...parsedData }` spread of the model's own JSON. */
const ENVELOPE_KEYS = new Set([
  'schemaVersion', 'text', 'model_used', 'inputTokens', 'outputTokens',
  'token_usage_estimate', 'error_code', 'error_message',
  'agent_id', 'agent_slug', 'agent_name', 'agent_service_scope',
]);

@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);

  async completeJson<T>(args: CompleteJsonArgs): Promise<{ data: T; meta: LlmMeta }> {
    const base = (process.env.AI_ORCHESTRATOR_URL || 'http://localhost:3380').replace(/\/$/, '');
    const tier = process.env.DRILL_GENERATION_MODEL_TIER || 'smart';

    const res = await fetch(`${base}/ai/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.mintServiceToken()}`,
      },
      signal: AbortSignal.timeout(this.resolveTimeoutMs()),
      body: JSON.stringify({
        model_tier: tier,
        system_prompt: args.systemPrompt,
        // output_schema is only a boolean flag upstream — the schema object
        // itself never reaches the provider, so serialize it into the prompt.
        user_prompt: this.withSchema(args.userPrompt, args.outputSchema),
        output_schema: args.outputSchema, // still what turns on JSON mode
        max_tokens: args.maxTokens ?? 8000,
        correlation_id: args.correlationId,
      }),
    });

    if (!res.ok) {
      // The body may echo prompt fragments or provider detail: log, never return.
      const body = await res.text().catch(() => '');
      this.logger.error(`ai/complete returned ${res.status}: ${body.slice(0, 500)}`);
      throw new ServiceUnavailableException(`ai/complete failed with status ${res.status}`);
    }

    const payload = (await res.json()) as AiCompleteResponse;

    // A provider failure arrives as HTTP 200 with empty text and an error_code.
    if (payload.error_code) {
      this.logger.error(
        `ai/complete reported ${payload.error_code}: ${(payload.error_message ?? '').slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(`ai/complete failed: ${payload.error_code}`);
    }

    const meta: LlmMeta = {
      model: payload.model_used ?? 'unknown',
      tier,
      promptTokens: payload.inputTokens ?? 0,
      completionTokens: payload.outputTokens ?? 0,
    };

    const raw = payload.text ?? '';
    if (raw.trim() === '') {
      // AiService spreads the parsed JSON across the top level on both the
      // LiteLLM and the CC-CLI path, so an empty `text` is still recoverable.
      const spread = this.extractSpreadPayload(payload);
      if (spread) return { data: spread as T, meta };
    }

    const unfenced = FENCE.exec(raw)?.[1] ?? raw;

    let data: T;
    try {
      data = JSON.parse(unfenced) as T;
    } catch {
      this.logger.warn(`ai/complete returned text that is not valid JSON (${raw.slice(0, 120)})`);
      throw new ServiceUnavailableException('ai/complete text is not valid JSON');
    }

    return { data, meta };
  }

  private withSchema(userPrompt: string, outputSchema: unknown): string {
    if (outputSchema === undefined || outputSchema === null) return userPrompt;
    return `${userPrompt}\n\nReturn JSON matching exactly this schema:\n${JSON.stringify(outputSchema)}`;
  }

  /** The secret is read here and never logged, stored, or thrown. */
  private mintServiceToken(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new ServiceUnavailableException('ai/complete auth is not configured');
    return JwtUtil.sign(SELF_SERVICE_ID, secret, SERVICE_TOKEN_TTL_SECONDS);
  }

  private resolveTimeoutMs(): number {
    const raw = Number(process.env.DRILL_LLM_TIMEOUT_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
  }

  private extractSpreadPayload(payload: AiCompleteResponse): Record<string, unknown> | null {
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (!ENVELOPE_KEYS.has(key)) extra[key] = value;
    }
    return Object.keys(extra).length > 0 ? extra : null;
  }
}
```

Requires `AI_ORCHESTRATOR_URL`, `DRILL_GENERATION_MODEL_TIER` (must be one of
`free|cheap|smart|premium` per `ModelTierSchema`, or `/ai/complete` 400s with no
hint why) and optionally `DRILL_LLM_TIMEOUT_MS` — all three are documented in
`ai-microservice/.env.example`.

- [ ] **Step 4: Run, confirm PASS (13 passed). Commit**

```bash
cd /home/ssf/Documents/Github/ai-microservice
rtk git add src/teacher-assistant/
rtk git commit -m "feat(ai): LLM client for the teacher assistant

Strips markdown fences and fails loudly on unparseable content rather
than passing garbage downstream.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task C.2: The generator agent

**Files:**
- Create: `ai-microservice/src/teacher-assistant/generate.prompt.ts`
- Create: `ai-microservice/src/teacher-assistant/generate.schema.ts`
- Create: `ai-microservice/src/teacher-assistant/generate.service.ts`
- Test: `ai-microservice/src/teacher-assistant/generate.service.spec.ts`

**Interfaces:**
- Consumes: `LlmClient`, `GenerateDrillRequest`, `GenerateDrillResponse`, `GeneratedDrillItem` from `./contracts`
- Produces: `GenerateService.generate(req: GenerateDrillRequest): Promise<GenerateDrillResponse>`, exposed as `POST /api/teacher-assistant/generate-drill`

- [ ] **Step 1: Write the prompt builder**

Create `generate.prompt.ts`. The prompt is a reviewable artifact, not a string
buried in a service:

```ts
import { GenerateDrillRequest } from './contracts';

export const GENERATE_SYSTEM_PROMPT = `You write fill-in-the-blank drill sentences for language learners.

OUTPUT FORMAT
Each sentence uses inline markup: [prompt]{answer}
  - "prompt" is what the learner sees as a placeholder, written in the MATERIAL language.
  - "answer" is what the learner must type, written in the TARGET language.
  - An empty prompt is allowed for suffix drills: "Ich heiß[]{e} Peter."
  - A sentence may contain more than one blank.

HARD RULES
1. Every sentence must exercise the requested grammar point in the BLANK itself.
   If the topic is prepositions, the blank must be a preposition — not an article,
   not a verb ending.
2. At least 80% of the content words across all sentences must come from the
   supplied known-vocabulary list.
3. No sentence may contain more than the stated maximum of new words.
4. Every new word must appear in that sentence's "hint" with its translation,
   in the style "(warten auf – ждать; der Bus – автобус)".
5. Sentences must be grammatically correct and natural in the target language.
   Never produce a word-for-word translation that a native speaker would not say.
6. No proper nouns beyond those in the known-vocabulary list.
7. Do not repeat, or lightly reword, any sentence in the avoid list.
8. One grammar point per sentence. Keep them short and everyday.

Return JSON only, matching the supplied schema. No commentary.`;

export function buildGenerateUserPrompt(req: GenerateDrillRequest): string {
  const topics = req.topics
    .map((t) => `- ${t.title} (${t.slug})${t.focus ? ` — focus on: ${t.focus}` : ''}`)
    .join('\n');

  return [
    `TARGET language: ${req.languageCode}`,
    `MATERIAL language (prompts and hints): ${req.materialLanguage}`,
    `Level: ${req.level ?? 'unspecified'}`,
    `Number of sentences to produce: ${req.count}`,
    `Maximum new words per sentence: ${req.maxNewWordsPerSentence}`,
    '',
    'TOPICS:',
    topics,
    '',
    `TEACHER'S REQUEST (follow it literally): ${req.instructions}`,
    '',
    `KNOWN VOCABULARY (${req.knownVocabulary.length} words):`,
    req.knownVocabulary.join(', '),
    '',
    'EXAMPLES of the required style and markup:',
    ...req.exampleItems.map((e) => `  ${e}`),
    '',
    `DO NOT PRODUCE these sentences or near-duplicates of them:`,
    ...req.avoidTexts.map((t) => `  ${t}`),
  ].join('\n');
}
```

- [ ] **Step 2: Write the output schema**

```ts
export const GENERATE_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['template', 'blanks', 'topicSlug', 'newWords'],
        properties: {
          template: { type: 'string' },
          blanks: {
            type: 'array',
            items: {
              type: 'object',
              required: ['prompt', 'answer'],
              properties: {
                prompt: { type: 'string' },
                answer: { type: 'string' },
                alternatives: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          hint: { type: ['string', 'null'] },
          topicSlug: { type: 'string' },
          newWords: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;
```

- [ ] **Step 3: Write the failing service test**

```ts
import { GenerateService } from './generate.service';
import { GenerateDrillRequest } from './contracts';

const req: GenerateDrillRequest = {
  languageCode: 'de', materialLanguage: 'ru', level: 'A2',
  topics: [{ slug: 'prepositions', title: 'Предлоги', focus: 'an, bei, für' }],
  instructions: '50 sentences, present tense only', count: 2,
  knownVocabulary: ['bus', 'schule'], maxNewWordsPerSentence: 2,
  exampleItems: ['Ich gehe [in]{in} die Schule.'], avoidTexts: ['Ich gehe in die Schule.'],
  correlationId: 'c-1',
};

describe('GenerateService.generate', () => {
  it('normalizes blanks by adding index and defaulting alternatives', async () => {
    const llm = {
      completeJson: jest.fn().mockResolvedValue({
        data: { items: [{
          template: 'Ich warte [на]{auf} den Bus.',
          blanks: [{ prompt: 'на', answer: 'auf' }],
          hint: '(warten auf – ждать)', topicSlug: 'prepositions', newWords: ['warten'],
        }] },
        meta: { model: 'm', tier: 'smart', promptTokens: 1, completionTokens: 2 },
      }),
    } as any;
    const svc = new GenerateService(llm);
    const res = await svc.generate(req);
    expect(res.items[0].blanks[0]).toEqual({
      index: 0, prompt: 'на', answer: 'auf', alternatives: [],
    });
  });

  it('passes the teacher instructions through verbatim', async () => {
    const llm = { completeJson: jest.fn().mockResolvedValue({ data: { items: [] }, meta: {} as any }) } as any;
    const svc = new GenerateService(llm);
    await svc.generate(req);
    expect(llm.completeJson.mock.calls[0][0].userPrompt)
      .toContain('50 sentences, present tense only');
  });

  it('includes the avoid list so the model does not repeat known items', async () => {
    const llm = { completeJson: jest.fn().mockResolvedValue({ data: { items: [] }, meta: {} as any }) } as any;
    const svc = new GenerateService(llm);
    await svc.generate(req);
    expect(llm.completeJson.mock.calls[0][0].userPrompt).toContain('Ich gehe in die Schule.');
  });

  it('returns an empty item list rather than throwing when the model returns none', async () => {
    const llm = { completeJson: jest.fn().mockResolvedValue({ data: { items: [] }, meta: {} as any }) } as any;
    const svc = new GenerateService(llm);
    await expect(svc.generate(req)).resolves.toMatchObject({ items: [] });
  });

  it('drops an item whose blanks field is missing entirely', async () => {
    const llm = {
      completeJson: jest.fn().mockResolvedValue({
        data: { items: [{ template: 'x', topicSlug: 'prepositions', newWords: [] }] },
        meta: {} as any,
      }),
    } as any;
    const svc = new GenerateService(llm);
    const res = await svc.generate(req);
    expect(res.items).toEqual([]);
  });
});
```

- [ ] **Step 4: Run, confirm failure. Implement**

```ts
import { Injectable } from '@nestjs/common';
import { LlmClient } from './llm.client';
import { GENERATE_SYSTEM_PROMPT, buildGenerateUserPrompt } from './generate.prompt';
import { GENERATE_OUTPUT_SCHEMA } from './generate.schema';
import { GenerateDrillRequest, GenerateDrillResponse, GeneratedDrillItem } from './contracts';

@Injectable()
export class GenerateService {
  constructor(private readonly llm: LlmClient) {}

  async generate(req: GenerateDrillRequest): Promise<GenerateDrillResponse> {
    const { data, meta } = await this.llm.completeJson<{ items: unknown[] }>({
      systemPrompt: GENERATE_SYSTEM_PROMPT,
      userPrompt: buildGenerateUserPrompt(req),
      outputSchema: GENERATE_OUTPUT_SCHEMA,
      correlationId: req.correlationId,
    });

    const items: GeneratedDrillItem[] = [];
    for (const raw of data.items ?? []) {
      const r = raw as Record<string, any>;
      if (typeof r.template !== 'string' || !Array.isArray(r.blanks)) continue;
      items.push({
        template: r.template,
        blanks: r.blanks.map((b: any, index: number) => ({
          index,
          prompt: String(b?.prompt ?? ''),
          answer: String(b?.answer ?? ''),
          alternatives: Array.isArray(b?.alternatives) ? b.alternatives.map(String) : [],
        })),
        hint: typeof r.hint === 'string' ? r.hint : null,
        topicSlug: String(r.topicSlug ?? ''),
        newWords: Array.isArray(r.newWords) ? r.newWords.map(String) : [],
      });
    }

    return { items, meta };
  }
}
```

Note what this does **not** do: it does not validate topic alignment, grammar,
or the vocabulary ratio. Those are the validator's and the orchestrator's job.
Keeping generation dumb is what makes the validator an independent check.

- [ ] **Step 5: Run, confirm PASS (5 passed). Commit**

```bash
rtk git add src/teacher-assistant/generate.*
rtk git commit -m "feat(ai): drill generator agent

Prompt and schema are separate reviewable files. The service only shapes
output; it deliberately performs no quality judgement.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task C.3: The validator agent

**Files:**
- Create: `ai-microservice/src/teacher-assistant/validate.prompt.ts`
- Create: `ai-microservice/src/teacher-assistant/validate.schema.ts`
- Create: `ai-microservice/src/teacher-assistant/validate.service.ts`
- Test: `ai-microservice/src/teacher-assistant/validate.service.spec.ts`

**Interfaces:**
- Consumes: `LlmClient`, `ValidateDrillRequest`, `ValidateDrillResponse`, `ItemValidationResult`
- Produces: `ValidateService.validate(req): Promise<ValidateDrillResponse>`, exposed as `POST /api/teacher-assistant/validate-drill`

- [ ] **Step 1: Write the prompt**

```ts
export const VALIDATE_SYSTEM_PROMPT = `You are a strict language-teaching editor. You review fill-in-the-blank drill sentences written by someone else.

You do NOT know who wrote them or why. Judge only what is in front of you.

Markup: [prompt]{answer} — "prompt" is the placeholder shown to the learner,
"answer" is what they must type.

For EVERY item, judge four things independently:

1. topicAlignment — does the BLANK actually exercise the requested grammar point?
   A preposition drill whose blank is an article is OFF_TOPIC, however good the
   sentence is. This is the check that matters most; be strict.
2. grammar — is the sentence correct in the target language once the answer is
   substituted? Judge the target language only; the prompt is in another language.
3. level — is the vocabulary and structure appropriate for the stated level?
4. naturalness — would a native speaker say this? Word-for-word translations
   from the material language are UNNATURAL even when grammatical.

Verdicts: PASS, WARN, or FAIL.
  - grammar may only be PASS or FAIL.
  - Use FAIL for topicAlignment when the blank tests the wrong thing.
  - Use WARN, not FAIL, for style you merely dislike.

When ANY verdict is FAIL you MUST supply suggestedFix: a corrected version of
the whole item in the same markup, preserving the intent and the topic. Never
return a FAIL with a null suggestedFix. A complaint without a correction is
useless to the teacher.

Issue codes: OFF_TOPIC, UNGRAMMATICAL, WRONG_LEVEL, UNNATURAL.

Return JSON only.`;
```

`buildValidateUserPrompt(req)` lists the topics, the teacher's instructions, the
target and material languages, the level, and then each item as
`#<itemRef>: <template>` with its hint. **It must not include** any statement of
where the items came from.

- [ ] **Step 2: Write the failing test**

```ts
import { ValidateService } from './validate.service';
import { ValidateDrillRequest } from './contracts';

const req: ValidateDrillRequest = {
  languageCode: 'de', materialLanguage: 'ru', level: 'A2',
  topics: [{ slug: 'prepositions', title: 'Предлоги' }],
  instructions: 'prepositions only',
  items: [
    { itemRef: 0, template: 'Ich warte [на]{auf} den Bus.', blanks: [], hint: null },
    { itemRef: 1, template: 'Ich sehe [die]{die} Schule.', blanks: [], hint: null },
  ],
  correlationId: 'c-1',
};

describe('ValidateService.validate', () => {
  it('maps a clean item to PASS with no issues', async () => {
    const llm = { completeJson: jest.fn().mockResolvedValue({
      data: { results: [{ itemRef: 0, verdicts: { topicAlignment: 'PASS', grammar: 'PASS', level: 'PASS', naturalness: 'PASS' }, issues: [], suggestedFix: null }] },
      meta: {} as any }) } as any;
    const svc = new ValidateService(llm);
    const res = await svc.validate(req);
    expect(res.results[0].state).toBe('PASS');
  });

  it('maps any FAIL verdict to state FAIL', async () => {
    const llm = { completeJson: jest.fn().mockResolvedValue({
      data: { results: [{ itemRef: 1,
        verdicts: { topicAlignment: 'FAIL', grammar: 'PASS', level: 'PASS', naturalness: 'PASS' },
        issues: [{ code: 'OFF_TOPIC', message: 'Blank is an article', span: 'die' }],
        suggestedFix: { template: 'Ich warte [на]{auf} die Schule.', blanks: [], hint: null } }] },
      meta: {} as any }) } as any;
    const svc = new ValidateService(llm);
    const res = await svc.validate(req);
    expect(res.results[0].state).toBe('FAIL');
    expect(res.results[0].issues[0].code).toBe('OFF_TOPIC');
  });

  it('maps WARN-only verdicts to state WARN', async () => {
    const llm = { completeJson: jest.fn().mockResolvedValue({
      data: { results: [{ itemRef: 0,
        verdicts: { topicAlignment: 'PASS', grammar: 'PASS', level: 'WARN', naturalness: 'WARN' },
        issues: [{ code: 'WRONG_LEVEL', message: 'B1 vocabulary' }], suggestedFix: null }] },
      meta: {} as any }) } as any;
    const svc = new ValidateService(llm);
    const res = await svc.validate(req);
    expect(res.results[0].state).toBe('WARN');
  });

  it('downgrades a FAIL with no suggestedFix to WARN and records it', async () => {
    const llm = { completeJson: jest.fn().mockResolvedValue({
      data: { results: [{ itemRef: 0,
        verdicts: { topicAlignment: 'FAIL', grammar: 'PASS', level: 'PASS', naturalness: 'PASS' },
        issues: [{ code: 'OFF_TOPIC', message: 'wrong' }], suggestedFix: null }] },
      meta: {} as any }) } as any;
    const svc = new ValidateService(llm);
    const res = await svc.validate(req);
    expect(res.results[0].state).toBe('WARN');
  });

  it('marks an item the model did not return as PENDING rather than dropping it', async () => {
    const llm = { completeJson: jest.fn().mockResolvedValue({
      data: { results: [{ itemRef: 0, verdicts: { topicAlignment: 'PASS', grammar: 'PASS', level: 'PASS', naturalness: 'PASS' }, issues: [], suggestedFix: null }] },
      meta: {} as any }) } as any;
    const svc = new ValidateService(llm);
    const res = await svc.validate(req);
    expect(res.results).toHaveLength(2);
    expect(res.results[1]).toMatchObject({ itemRef: 1, state: 'PENDING' });
  });

  it('never sends any hint about item provenance to the model', async () => {
    const llm = { completeJson: jest.fn().mockResolvedValue({ data: { results: [] }, meta: {} as any }) } as any;
    const svc = new ValidateService(llm);
    await svc.validate(req);
    const prompt = llm.completeJson.mock.calls[0][0].userPrompt.toLowerCase();
    expect(prompt).not.toContain('generated');
    expect(prompt).not.toContain('ai');
    expect(prompt).not.toContain('bank');
  });
});
```

Test 4 is the important one. A model that says "this is wrong" without saying
what right looks like leaves the teacher stuck, so a FAIL without a fix is
treated as a WARN rather than blocking approval. Test 5 prevents silent item
loss: an item the model skipped must stay visible as unjudged.

- [ ] **Step 3: Run, confirm failure. Implement**

The mapping rule, in order:
1. If the model omitted an `itemRef`, emit `{ itemRef, state: 'PENDING', issues: [], suggestedFix: null }`.
2. If any verdict is `FAIL` **and** `suggestedFix` is present → `FAIL`.
3. If any verdict is `FAIL` **and** `suggestedFix` is absent → `WARN`, and append an issue with the model's original message.
4. Else if any verdict is `WARN` → `WARN`.
5. Else → `PASS`.

- [ ] **Step 4: Run, confirm PASS (6 passed)**

- [ ] **Step 5: Commit**

```bash
rtk git add src/teacher-assistant/validate.*
rtk git commit -m "feat(ai): independent drill validator agent

The validator never learns where an item came from. A FAIL without a
suggested correction is downgraded to WARN, because a complaint the
teacher cannot act on should not block approval.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task C.4: Controller and prompt evaluation harness

**Files:**
- Create: `ai-microservice/src/teacher-assistant/teacher-assistant.controller.ts`
- Create: `ai-microservice/src/teacher-assistant/__evals__/run-eval.ts`
- Test: `ai-microservice/src/teacher-assistant/teacher-assistant.controller.spec.ts`

**Interfaces:**
- Produces: `POST /api/teacher-assistant/generate-drill`, `POST /api/teacher-assistant/validate-drill`, both JWT-guarded

- [ ] **Step 1: Write the controller with the service's existing JWT guard**

Read how a sibling controller in ai-microservice guards its routes (for example
under `src/ai/`) and use the identical guard. Do not introduce a new one.

- [ ] **Step 2: Write the controller test**

Assert: both routes are guarded; a request missing `languageCode` is rejected
with 400; a well-formed request delegates to the right service exactly once.

- [ ] **Step 3: Write the eval harness**

`__evals__/run-eval.ts` is a manual script, not a jest test — it costs tokens and
must never run in CI. It generates 10 items for three language pairs
(de/ru, en/ru, fr/ru) on the topic `prepositions`, runs the validator over the
output, and prints a table: items generated, PASS/WARN/FAIL counts, and every
`OFF_TOPIC` issue in full.

```bash
# usage — run manually, never in CI
rtk npx ts-node src/teacher-assistant/__evals__/run-eval.ts
```

Record the first run's table in the status file. It is the baseline for judging
future prompt changes; without it, prompt edits are guesswork.

- [ ] **Step 4: Run tests, typecheck, commit**

```bash
cd /home/ssf/Documents/Github/ai-microservice
rtk npm test -- teacher-assistant && rtk npm run typecheck
rtk git add src/teacher-assistant/ src/app.module.ts
rtk git commit -m "feat(ai): teacher assistant endpoints and eval harness

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track C completion checklist

- [ ] `rtk npm test -- teacher-assistant` green
- [ ] `rtk npm run typecheck` clean
- [ ] Eval harness run once against the real model, table recorded in the status file
- [ ] The provenance test (C.3 step 2, test 6) passes — the validator is blind to item origin
- [ ] Status file at `status/track-c.md`

**Hand off to Track D.** It calls both endpoints and depends on the
`ItemValidationResult` state mapping being exactly as specified above.
