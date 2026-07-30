# Track A — Item Bank and Vocabulary Baseline

**State:** COMPLETE · **Branch:** feat/drilling-assignments · **Commits:** d02c0db..642fdca
**Service:** speakasap/content-service · **Unblocks:** Track A2 (library), Track D (orchestration)

## Verification on the final tree

```
content-service: 91 tests / 11 suites passing · typecheck clean
api-gateway:      8 tests passing · typecheck clean
sync-drill-contracts.sh --check → exit 0
```

## What exists now

| Piece | Location |
|---|---|
| Bank models `DrillTopic`/`DrillItem`/`DrillItemRevision` | `prisma/schema.prisma` |
| `CourseVocabulary` model | `prisma/schema.prisma` |
| Template parser `parseTemplate`/`toSegments`/`hashItem` | `src/drills/template.ts` |
| Legacy Python parser | `src/drills/legacy-parser.ts` |
| Seven lesson/course mapping | `src/drills/seven-mapping.ts` |
| Tokenizer + stopwords | `src/vocabulary/{tokenize,stopwords}.ts` |
| HTML stripper | `src/vocabulary/html-strip.ts` |
| Lowest-lesson dedup | `src/vocabulary/collapse-to-earliest-lesson.ts` |
| `VocabularyService.getBaseline` | `src/vocabulary/vocabulary.service.ts` |
| 80/20 ratio checker | `src/vocabulary/ratio.ts` |
| Bank query service + controllers | `src/drills/drills.{service,controller}.ts`, `src/vocabulary/vocabulary.controller.ts` |
| Importers (written, NOT run) | `scripts/import-{grammar,seven}-bank.ts` |
| Vocabulary builder (written, NOT run) | `scripts/build-course-vocabulary.ts` |

## Deferred to the orchestrator (Track K)

Three migrations are **created and not applied**: `drill_bank`, `course_vocabulary`, and A.8's
(if any). Three scripts are **written and never executed** — the DB is unreachable from the
dev host by design, so all data migration happens in-cluster under the deploy lock:

1. `import-grammar-bank.ts` — dry-run measured **24,808** labels, 24,102 insertable
2. `import-seven-bank.ts` — dry-run measured **3,565** labels, 3,477 insertable
3. `build-course-vocabulary.ts` — never run; **real coverage numbers are unknown**

The two importer totals sum to 28,373, which matches an independent count of every
`SmartExerciseField(` occurrence in the legacy tree — the parsers are provably complete and
non-overlapping.

## API surface for Track D

```
GET  /api/v1/drill-topics                      public-authenticated (no answers)
POST /api/v1/internal/drill-items/search       INTERNAL — requires x-internal-token
GET  /api/v1/internal/course-vocabulary        INTERNAL — requires x-internal-token
```

The last two are internal **because their responses carry `answer` and `alternatives`**.
Track D must send `x-internal-token`. Do not promote them to a public prefix.

## Things Track A2 / D must know

1. **`GrammarLesson` has 0 rows.** `DrillTopicDTO.publicUrl` is `null` for every topic.
   Worse, exercise class names are English CamelCase while real grammar URLs are
   transliterated Russian (`pravila-chteniya`) — there is no mechanical mapping. **Owner
   decision pending.** Do not build a fallback that invents a URL from a slug.
2. **`Word`/`WordTheme`/`WordThemeRelation` have 0 rows**, so the curated vocabulary source
   does not exist. The baseline is built from `SevenLesson.bodyHtml` (rich: 136/136, ~12k
   chars) plus imported drill items. `THEME` is kept in the type union but never emitted.
3. **`chinese`, `english`, `japanese` have no lesson-mapped items at all** — their legacy
   files hold only multiple-choice `TestField` items, or are empty.
4. **`checkVocabularyRatio` is honest, not forgiving.** A course with `hasBaseline: false`
   always fails it, by construction. **Track D must hold an explicit, reviewed allowlist of
   courses known to have no vocabulary by design, and must surface any *other*
   `hasBaseline: false` loudly rather than silently skipping the gate** — a failed or
   never-run vocabulary build is indistinguishable at that layer from an intentional gap.
   Consider routing such a set to `PENDING_REVIEW` rather than `APPROVED`.
5. **Contract changes made in this track** (all re-vendored to five copies + ai-microservice):
   - `DRILL_BLANK_PATTERN` corrected to `/\[([^\[\]]*)\]\{([^{}]*)\}/g`
   - `VocabularyBaseline` gained `hasBaseline: boolean`
   - `VocabularyRatioResult` briefly gained then lost `assessed` — do not reintroduce it; it
     was a pure echo of `baseline.hasBaseline`, which every caller already has.
6. **The tokenizer is frozen.** It splits on apostrophes, keeps hyphenated compounds whole
   unless every part is a stopword, and never strips diacritics.

## Plan defects found and corrected during execution

1. `@@map` was mandated globally; content-service uses none. Per-service convention now wins.
2. The template regex let an unclosed `[` swallow sentence text. Verified against all 28,373
   real labels: 5 differ, all malformed source that now gets reported rather than imported
   wrong. **Contract change**, caught before Tracks B/C/D consumed it.
3. The legacy files use Python implicit string concatenation across lines in 7 places; the
   planned regex would have corrupted those labels.
4. Stopword lists leaked function words: **6.6% of real French tokens** were bare elision
   remnants. Measured before/after with a metric independent of the list: 66 → 0.20 per 1,000.
5. A hyphen-split rule the controller specified shredded `week-end` and `rendez-vous`.
   Replaced with the all-parts-are-stopwords rule.
6. The A.7 fixture `w0..w39` all tokenize to `w` (digits are excluded), making the
   per-sentence-cap test vacuous as written.
7. A fail-open on `hasBaseline: false` would have let a *failed* vocabulary build silently
   open the gate. Reverted to honest reporting; policy moved to the caller.
8. **Critical:** `drill-items/search` returns answers, and the gateway performs no role
   check, so any authenticated student could have harvested the entire answer bank. Routes
   moved behind the internal prefix.

## Deferred minors (for the final whole-branch review)

- `blankRe()` in `template.ts` forwards only the `'g'` flag; if `DRILL_BLANK_PATTERN` ever
  gains flags they are silently dropped. One-word fix using `.flags`.
- fr/es/ru stopword lists still lack some common function words. Lower harm than the elision
  remnants: real function words appear in lesson text, so they land in the baseline and count
  as *known*.
- `dc1ffc9` (the hyphen-compound fix) was a **controller fix applied without subagent
  review**, because a session limit blocked dispatch mid-round. It has tests and a measured
  before/after, but it did not go through the normal gate.

## Out of scope, found here, needs an owner

`api-gateway/src/proxy/gateway-auth.guard.ts` performs **no role check anywhere**. Any valid
bearer token reaches any non-`/internal` route. Prefixes that look staff-only but are not
(flagged by name; response content not audited): `/api/v1/admin/*`, `/api/v1/manager/*`,
`/api/v1/salary-*`, `/api/v1/payout-runs`, `/api/v1/calculation-runs`, `/api/v1/contracts`,
`/api/v1/dashboard/overview`, `/api/v1/revenue`, `/api/v1/expenses`,
`/api/v1/employee-profiles`. This predates the drilling feature and deserves its own sweep.
