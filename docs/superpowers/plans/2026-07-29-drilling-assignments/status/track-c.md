# Track C — Generator and Validator Agents — COMPLETE

**Service:** `ai-microservice` (a different repository from `speakasap`).
**Branch:** `feat/drilling-assignments`, from `main` at `3c68417`.
**Owns:** `src/teacher-assistant/**`.

---

## 1. What Track C delivers

Two **independent** AI agents behind two JWT-guarded HTTP routes:

| File | Purpose |
|---|---|
| `llm.client.ts` | The only thing in the directory that talks to `/ai/complete`. Signs a service JWT, appends the output schema to the prompt, strips markdown fences, and fails loudly. |
| `generate.prompt.ts` / `.schema.ts` / `.service.ts` | Writes drill sentences. Performs **no** quality judgement — deliberately. |
| `validate.prompt.ts` / `.schema.ts` / `.service.ts` | Judges drill sentences, blind to their origin. |
| `teacher-assistant.controller.ts` + `dto/` | `POST /api/teacher-assistant/generate-drill`, `POST /api/teacher-assistant/validate-drill`. |
| `__evals__/run-eval.ts` | Manual prompt-quality harness. Never runs in CI; excluded from `dist/`. |

**The design rule the track exists to protect:** the validator receives only the items and
the original request — never the generator's prompt, reasoning, or any signal that an item
was machine-written. A validator that knows what the generator was trying to do will
rubber-stamp it.

## 2. Interfaces Track D consumes

```ts
GenerateService.generate(req: GenerateDrillRequest): Promise<GenerateDrillResponse>
ValidateService.validate(req: ValidateDrillRequest): Promise<ValidateDrillResponse>
```

State mapping, in order — Track D depends on this exactly:

1. Model omitted the item → `PENDING`
2. any verdict `FAIL` **and** `suggestedFix` present → `FAIL`
3. any verdict `FAIL` **and** no `suggestedFix` → `WARN`, reason preserved (synthesized from
   the failing verdict category when the model supplied no issue)
4. any verdict `WARN` → `WARN`
5. else → `PASS`

Malformed or missing `verdicts` → `PENDING`, never `PASS`.

## 3. Verification

- **201 tests / 18 suites passing**, typecheck clean via `./node_modules/.bin/tsc --noEmit -p tsconfig.json`
  (this repo has **no** `typecheck` script — never use `npx tsc`).
- Every behavioural fix was falsified by reverting it and confirming the covering test fails.

## 4. Eval baseline — 2026-07-31

**Run against real models.** 10 items per pair, topic `prepositions`, generator then validator.

```
┌─────────┬────────────────┬──────┬──────┬──────┬─────────┐
│ pair    │ itemsGenerated │ pass │ warn │ fail │ pending │
├─────────┼────────────────┼──────┼──────┼──────┼─────────┤
│ de/ru   │ 10             │ 9    │ 1    │ 0    │ 0       │
│ en/ru   │ 10             │ 8    │ 2    │ 0    │ 0       │
│ fr/ru   │ 10             │ 6    │ 2    │ 2    │ 0       │
└─────────┴────────────────┴──────┴──────┴──────┴─────────┘
OFF_TOPIC issues: none
```

**30/30 items generated, 23 PASS, 5 WARN, 2 FAIL, 0 PENDING.**

Reading it:
- **Zero `OFF_TOPIC`** across all three pairs — the blank exercises the requested grammar
  point every time. That is the check the validator prompt calls the one that matters most.
- **Zero `PENDING`** — the validator returned a judgement for every item, so `itemRef`
  correlation is working end to end.
- **fr/ru is the weak pair** (6/2/2 vs 9/1/0 for de/ru). Worth attention before French ships.

**The baseline is tied to the model.** It was measured with `smart` =
`openrouter/google/gemma-4-31b-it:free`. Re-measure after any change to
`litellm_config.yaml`, the prompts, or the tier — the numbers are not comparable across
models.

### Reproducing

```bash
kubectl port-forward -n statex-apps svc/ai-microservice 3380:3380 &
export JWT_SECRET=$(kubectl get secret -n statex-apps ai-microservice-secret \
  -o go-template='{{index .data "JWT_SECRET"}}' | base64 -d)   # never echo this
export AI_ORCHESTRATOR_URL=http://127.0.0.1:3380
export DRILL_GENERATION_MODEL_TIER=smart
# no ts-node in this repo; compile inside the tree so node_modules resolves
./node_modules/.bin/tsc -p tsconfig.json --outDir .evaltmp --noEmit false
node .evaltmp/src/teacher-assistant/__evals__/run-eval.js
rm -rf .evaltmp
```

## 5. Handoff notes — Track D must read these

1. **Results come back in the model's order**, with `PENDING` entries appended — **not**
   `req.items` order. **Key by `itemRef`, never by array index.**
2. **`PENDING` has three distinct causes**: the model omitted the item, `verdicts` was
   malformed, or a verdict value was outside its enum. Treat it as *retry or escalate*,
   never as "clean".
3. **`state` is never `OVERRIDDEN`** from this service — that transition is Track D's.
4. **Both routes return 200**, require a service JWT (`ServiceAuthGuard`), and today throw
   `503` for every upstream problem. Retry policy cannot yet distinguish a rate limit from
   malformed JSON.
5. **`acceptedText` is the student's raw trimmed text**, never the normalized form — see
   Track B's handoff note 3.
6. **`suggestedFix.blanks` is normalized** (`index` assigned by position, `alternatives`
   defaulted) so it satisfies `DrillBlank`. A fix whose `template` is not a non-empty
   string counts as absent and triggers the FAIL→WARN downgrade.

## 6. Parked findings (real, non-blocking)

- Timeout rejections surface as a Nest 500 rather than the 503 every other failure path
  produces — `fetch` is not wrapped in try/catch.
- The `text`-empty fallback in `llm.client.ts` is dead code against today's `AiService`
  (safe: it degrades to 503, never to wrong data).
- C3's schema append happens inside `LlmClient`, **after** `validate.service.spec.ts`
  inspects the prompt — so that provenance test no longer covers what actually goes on the
  wire. Not a leak (the system prompt already explains the markup), but the coverage gap
  is real.
- The provenance denylist is a heuristic. It strips sentence-final and mid-sentence terms,
  but it cannot catch every phrasing a teacher might type.

## 7. Infrastructure fixed along the way

Every LiteLLM tier was dead — `smart` pointed at Gemini (unused here), `cheap` at an
OpenRouter slug that had been **retired** (404), and every fallback chained to a 0.5b
Ollama CPU model too slow for real prompts, so requests hung 120s and returned 500. This
affected **every** AI-consuming service, not just this eval. Repointed in
`ai-microservice@0039719` to verified free models across two vendors, primary and fallback
deliberately from different vendors so one retired slug cannot take both down.

**OpenRouter's free catalogue rotates.** Re-verify slugs periodically:
`curl -H "Authorization: Bearer $OPENROUTER_API_KEY" https://openrouter.ai/api/v1/models`

Ollama was **not** at fault: it is up, on the right network, listening on **11435** (not
the 11434 the old comment claimed), with the referenced model pulled, idle at 0.00% CPU
and 118 MB. It is simply too slow for long drill prompts.
