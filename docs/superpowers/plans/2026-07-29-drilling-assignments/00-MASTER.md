# Drilling Assignments — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher request targeted grammar drilling for a student, have the system assemble and validate the sentences, and have the student practise them in the browser with instant per-blank feedback.

**Architecture:** A reusable `DrillSet` is the unit of review and reuse. content-service owns the item bank, the vocabulary baseline and the sets; education-service owns per-student assignments, attempts and grading; ai-microservice hosts a generator agent and an independent validator agent; the Next.js frontend hosts both the student runner and the teacher wizard. Answers never leave the server.

**Tech Stack:** NestJS 10 · Prisma 5 · PostgreSQL · Next.js 15 (App Router) · Jest 29 + ts-jest · TypeScript 5.4

**Spec:** [`../../specs/2026-07-29-drilling-assignments-design.md`](../../specs/2026-07-29-drilling-assignments-design.md)

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Never `npx tsc`.** Typecheck by path: `./node_modules/.bin/tsc --noEmit -p tsconfig.json`. `npx tsc` silently runs the unrelated registry package `tsc@2.0.4`, which prints "This is not the tsc command you are looking for" — and rtk parses that as "No errors found", exactly like a real pass.
- **Prefix shell commands with `rtk`**, including every segment of a chain (`rtk git add . && rtk git commit -m "..."`).
- **Search with `rg`, never `grep`/`find`.** Note: `rg` here is a GNU grep shim — use `-E` for extended regex or patterns silently match nothing.
- **Subagents must not deploy.** Build, test and typecheck locally, then report ready. Deploys are serialized ecosystem-wide by the orchestrating session via `shared/scripts/with-deploy-lock.sh`.
- **No secrets in code, logs or markdown.** All secrets live in Vault at `secret/prod/<service>`.
- **Answers are server-side only.** No endpoint that a student can call may return `answer` or `alternatives`. Task 7.4 enforces this with a test; do not weaken it.
- **First-try accuracy is never shown to a teacher.** Item-level correctness counters exist for bank selection only. No teacher-facing screen, list, panel or email displays a score.
- **Prisma model names use `Drill` prefix**; table names are snake_case with a `drill_` prefix via `@@map`.
- **All new HTTP routes are versioned** under `/api/v1/`.
- **Commit after every task.** Conventional Commits, ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Language of user-visible copy**: prompts and UI strings in the recipient's material language (`ru` or `en`); code, comments and commits in English.

---

## Contracts

These types are the interface between tracks. They are written **once**, in
`speakasap/shared/contracts/drills.contracts.ts`, and vendored into each
consumer by `shared/scripts/sync-drill-contracts.sh`. Task 0.2 creates both.

**Rule for every track:** import from your service's vendored copy
(`src/drills/contracts.ts`). Never redeclare a contract type locally. If a
contract needs to change, change the source file, re-run the sync script, and
say so in your handoff — a contract change invalidates other tracks' work.

### C1 — Template markup and parsing

```ts
/** Inline drill markup: "Ich gehe [in]{in} die Schule." — [prompt]{answer}. */
export type DrillTemplate = string;

export interface DrillBlank {
  /** 0-based, matches order of appearance in the template. */
  index: number;
  /** Placeholder shown to the student. May be an empty string (suffix drills: "Ich heiß[]{e}"). */
  prompt: string;
  /** The expected answer. NEVER serialized to a student-facing response. */
  answer: string;
  /** Additional accepted answers. NEVER serialized to a student-facing response. */
  alternatives: string[];
}

export interface ParsedTemplate {
  blanks: DrillBlank[];
  /** Template with answers substituted and markup removed. Used for hashing and search. */
  plainText: string;
}

export const DRILL_BLANK_PATTERN = /\[([^\]]*)\]\{([^}]*)\}/g;
```

### C2 — Bank

```ts
export type DrillItemSource = 'BANK_GRAMMAR' | 'BANK_SEVEN' | 'AI' | 'TEACHER';
export type DrillItemStatus = 'ACTIVE' | 'RETIRED';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface DrillTopicDTO {
  id: number;
  slug: string;
  title: string;
  languageCode: string;
  materialLanguage: string;
  level: CefrLevel | null;
  /** Public grammar page URL, derived from GrammarLesson.url. Null when unmapped. */
  publicUrl: string | null;
  isNew: boolean;
}

export interface DrillItemDTO {
  id: number;
  languageCode: string;
  materialLanguage: string;
  topicSlug: string | null;
  level: CefrLevel | null;
  template: DrillTemplate;
  blanks: DrillBlank[];
  hint: string | null;
  sourceType: DrillItemSource;
  courseKey: string | null;
  lessonOrder: number | null;
  unknownWords: string[];
  hash: string;
}

export interface DrillItemSearchRequest {
  languageCode: string;
  materialLanguage: string;
  topicSlugs: string[];
  level?: CefrLevel;
  courseKey?: string;
  /** Restrict course-material items to lessons at or below this order. */
  maxLessonOrder?: number;
  /** When present, items violating the 80/20 rule against this baseline are excluded. */
  vocabularyBaseline?: string[];
  limit: number;
  excludeHashes?: string[];
  /** Deterministic ordering for tests. */
  seed?: number;
}

export interface DrillItemSearchResponse {
  items: DrillItemDTO[];
  /** Number of items matching before `limit` was applied. */
  totalAvailable: number;
}
```

### C3 — Vocabulary

```ts
export type VocabularySource = 'THEME' | 'ITEM' | 'LESSON_BODY';

export interface VocabularyWord {
  word: string;
  lemma: string | null;
  translation: string | null;
  lessonOrder: number;
  source: VocabularySource;
}

export interface VocabularyBaseline {
  courseKey: string;
  languageCode: string;
  maxLessonOrder: number;
  words: VocabularyWord[];
  /** Lowercased, NFC-normalized surface forms + lemmas, for O(1) membership tests. */
  index: string[];
}

export interface VocabularyRatioResult {
  /** Fraction of content-word tokens present in the baseline, 0..1. */
  knownRatio: number;
  /** Content words not in the baseline, deduplicated, in order of first appearance. */
  unknownWords: string[];
  /** Per-item unknown counts, keyed by item index in the input array. */
  perItemUnknownCount: number[];
  /** True when knownRatio >= 0.8 AND every perItemUnknownCount <= 2. */
  passes: boolean;
}

export const VOCABULARY_MIN_KNOWN_RATIO = 0.8;
export const VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE = 2;
```

### C4 — Sets, validation, library

```ts
export type DrillSetOrigin = 'AI' | 'BANK' | 'MIXED' | 'TEACHER';
export type DrillSetReviewState = 'GENERATING' | 'VALIDATING' | 'PENDING_REVIEW' | 'APPROVED';
export type ValidationState = 'PENDING' | 'PASS' | 'WARN' | 'FAIL' | 'OVERRIDDEN';

export type ValidationIssueCode =
  | 'MARKUP_UNPARSEABLE'
  | 'BLANK_COUNT_MISMATCH'
  | 'EMPTY_ANSWER'
  | 'WRONG_SCRIPT'
  | 'RESIDUAL_MARKUP'
  | 'DUPLICATE'
  | 'VOCABULARY_RATIO'
  | 'CLOSED_LIST_MISMATCH'
  | 'OFF_TOPIC'
  | 'UNGRAMMATICAL'
  | 'WRONG_LEVEL'
  | 'UNNATURAL';

export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  span?: string;
}

export interface ItemValidationResult {
  /** Position of the item within the set, 0-based. */
  itemRef: number;
  state: ValidationState;
  issues: ValidationIssue[];
  suggestedFix: { template: DrillTemplate; blanks: DrillBlank[]; hint: string | null } | null;
}

export interface DrillSetItemDTO {
  id: number;
  order: number;
  item: DrillItemDTO;
  validationState: ValidationState;
  validationIssues: ValidationIssue[];
  validatedAt: string | null;
}

export interface DrillSetDTO {
  uuid: string;
  title: string;
  languageCode: string;
  materialLanguage: string;
  level: CefrLevel | null;
  topicSlugs: string[];
  courseKey: string | null;
  lessonOrder: number | null;
  origin: DrillSetOrigin;
  reviewState: DrillSetReviewState;
  createdByTeacherId: number | null;
  instructions: string | null;
  visibility: 'SHARED' | 'PRIVATE';
  knownWordRatio: number | null;
  timesAssigned: number;
  timesSelfSelected: number;
  teacherUpvotes: number;
  studentUpvotes: number;
  popularityScore: number;
  itemCount: number;
  createdAt: string;
  approvedAt: string | null;
}

/** Full set including items and answers. Teacher auth only — never returned to a student. */
export interface DrillSetDetailDTO extends DrillSetDTO {
  items: DrillSetItemDTO[];
}

export interface DrillSetListQuery {
  languageCode?: string;
  materialLanguage?: string;
  topicSlugs?: string[];
  courseKey?: string;
  lessonOrder?: number;
  /** Full-text search over item plain text. Deliberately ignores courseKey/lessonOrder. */
  q?: string;
  sort?: 'popularity' | 'recent';
  createdBy?: number;
  reviewState?: DrillSetReviewState;
  groupBy?: 'lesson';
  limit?: number;
  offset?: number;
}

export interface DrillSetListResponse {
  sets: DrillSetDTO[];
  total: number;
  /** Present only when groupBy=lesson. Key format: `${courseKey}#${lessonOrder}` or 'unassigned'. */
  groups?: Record<string, string[]>;
}
```

### C5 — AI agents

```ts
export interface GenerateDrillRequest {
  languageCode: string;
  materialLanguage: string;
  level: CefrLevel | null;
  topics: { slug: string; title: string; focus?: string }[];
  /** The teacher's verbatim free-text request. */
  instructions: string;
  count: number;
  /** Surface forms the student already knows. */
  knownVocabulary: string[];
  maxNewWordsPerSentence: number;
  /** Few-shot examples in DrillTemplate markup. */
  exampleItems: DrillTemplate[];
  /** plainText of items already chosen; the model must not repeat these. */
  avoidTexts: string[];
  correlationId: string;
}

export interface GeneratedDrillItem {
  template: DrillTemplate;
  blanks: DrillBlank[];
  hint: string | null;
  topicSlug: string;
  newWords: string[];
}

export interface GenerateDrillResponse {
  items: GeneratedDrillItem[];
  meta: { model: string; tier: string; promptTokens: number; completionTokens: number };
}

export interface ValidateDrillRequest {
  languageCode: string;
  materialLanguage: string;
  level: CefrLevel | null;
  topics: { slug: string; title: string; focus?: string }[];
  instructions: string;
  items: { itemRef: number; template: DrillTemplate; blanks: DrillBlank[]; hint: string | null }[];
  correlationId: string;
}

export interface ValidateDrillResponse {
  results: ItemValidationResult[];
  meta: { model: string; tier: string; promptTokens: number; completionTokens: number };
}
```

### C6 — Assignments and the runner

```ts
export type DrillAssignmentStatus =
  | 'GENERATING' | 'PENDING_REVIEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type DrillAssignmentOrigin = 'TEACHER' | 'SELF';
export type GenerationPhase =
  | 'RESOLVING' | 'BANK' | 'GENERATING' | 'VALIDATING' | 'READY' | 'FAILED';

export interface GenerationProgress {
  phase: GenerationPhase;
  generated: number;
  total: number;
  etaSeconds: number | null;
  message: string;
  /** True when the job has passed its estimate without progressing. */
  stalled: boolean;
}

export interface DrillAssignmentDTO {
  uuid: string;
  setUuid: string;
  studentId: number;
  teacherId: number | null;
  origin: DrillAssignmentOrigin;
  lessonUuid: string | null;
  title: string;
  languageCode: string;
  materialLanguage: string;
  status: DrillAssignmentStatus;
  dueAt: string | null;
  resourceLinks: { topic: string; url: string }[];
  itemCount: number;
  /** Blanks the student has answered correctly, out of the total. */
  blanksCorrect: number;
  blanksTotal: number;
  generationProgress: GenerationProgress | null;
  createdAt: string;
  assignedAt: string | null;
  completedAt: string | null;
}

/** ANSWER-FREE. This is the only item shape a student-authenticated call may return. */
export interface RunnerBlankDTO {
  index: number;
  prompt: string;
  /** Character budget for the input box. Derived from the answer length, never the answer. */
  maxLength: number;
  /** Already solved in an earlier session — render as resolved text. */
  solved: boolean;
  /** The accepted text, present ONLY when solved is true (the student already typed it). */
  solvedText: string | null;
}

export interface RunnerItemDTO {
  uuid: string;
  order: number;
  /** Template with markup stripped to positional placeholders — carries no answers. */
  segments: ({ type: 'text'; value: string } | { type: 'blank'; index: number })[];
  blanks: RunnerBlankDTO[];
  hint: string | null;
}

export interface RunnerResponse {
  assignment: DrillAssignmentDTO;
  items: RunnerItemDTO[];
}

export interface CheckBlankRequest {
  itemUuid: string;
  blankIndex: number;
  value: string;
}

export interface CheckBlankResponse {
  correct: boolean;
  /** The normalized form accepted, echoed back for rendering. Present only when correct. */
  acceptedText: string | null;
  attemptNo: number;
  blanksCorrect: number;
  blanksTotal: number;
  /** Server-decided. The client must not infer completion itself. */
  assignmentCompleted: boolean;
}
```

### C7 — Errors

```ts
export type DrillErrorCode =
  | 'ASSIGNMENT_OUTSTANDING'   // 409 — self-drill blocked by pending teacher work
  | 'SET_NOT_APPROVED'         // 403 — student tried an unapproved set
  | 'SET_AHEAD_OF_STUDENT'     // 403 — lessonOrder beyond the student's progress
  | 'UNRESOLVED_VALIDATION_FAILURES' // 409 — approve attempted with open FAILs
  | 'GENERATION_IN_PROGRESS'   // 409 — mutation attempted mid-generation
  | 'IDENTITY_UNRESOLVED';     // 503 — legacy mapping lookup unavailable, fail closed

export interface DrillErrorBody {
  statusCode: number;
  code: DrillErrorCode;
  message: string;
  /** Present on ASSIGNMENT_OUTSTANDING — the assignment the student must finish first. */
  blockingAssignmentUuid?: string;
}
```

### C8 — Internal endpoints (transitional legacy portal)

```ts
/** GET /api/v1/internal/drill-assignments/by-student/:studentId */
export interface InternalStudentAssignmentsResponse {
  outstanding: DrillAssignmentDTO[];
  completedRecent: DrillAssignmentDTO[];
  /** False when any assignment is ASSIGNED or IN_PROGRESS. Mirrors the §9.3 gate. */
  selfDrillingAllowed: boolean;
}

/** GET /api/v1/internal/drill-assignments/by-teacher/:teacherId */
export interface InternalTeacherAssignmentsResponse {
  awaitingReview: number;
  assigned: number;
  completedThisWeek: number;
  /** Sets blocking a student, most recent first, capped at 20. */
  reviewQueue: { setUuid: string; title: string; studentCount: number; createdAt: string }[];
}

/** GET /api/v1/internal/drill-assignments/by-lesson/:lessonUuid */
export interface InternalLessonAssignmentsResponse {
  assignments: (DrillAssignmentDTO & { studentName: string })[];
}
```

### C9 — Identity

```ts
/** POST /internal/users/resolve-or-provision-legacy on auth-microservice. */
export interface ResolveLegacyUserRequest {
  system: 'speakasap-portal';
  legacyUserId: number;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface ResolveLegacyUserResponse {
  authUserId: string;
  /** True when this call created the mapping rather than finding it. */
  provisioned: boolean;
}
```

---

## File Ownership Matrix

No two tracks write the same file. Tracks that must touch a shared file do so in
the wave where they are the sole writer, marked below.

| Track | Repo / service | Owns |
|---|---|---|
| 0 | speakasap (repo-wide) | `package.json` (root, new), `scripts/run-all.sh`, `jest.config.base.js`, `<service>/jest.config.js` × 11, `frontend/vitest.config.ts` + `vitest.setup.ts`, test/typecheck scripts in all 12 packages, `shared/contracts/*`, `shared/scripts/sync-drill-contracts.sh`, `api-gateway/src/proxy/upstream-resolve.ts` |
| A | speakasap/content-service | `prisma/schema.prisma` (bank + vocabulary models), `src/drills/**` except `sets/**`, `src/vocabulary/**`, `scripts/import-*.ts` |
| A2 | speakasap/content-service | `prisma/schema.prisma` (set models — sole writer after A completes), `src/drills/sets/**` |
| B | speakasap/education-service | `prisma/schema.prisma` (drill models), `src/drills/**` except `orchestration/**` and `runner/**` |
| B2 | speakasap/education-service | `src/drills/runner/**`, `src/drills/drills.controller.ts`, `src/drills/internal-drills.controller.ts` |
| C | ai-microservice | `src/teacher-assistant/**` |
| D | speakasap/education-service | `src/drills/orchestration/**` only |
| E | speakasap/frontend | `app/learner/practice/**`, `lib/drills/runner/**` |
| F | speakasap/frontend | `app/teacher/assignments/**`, `lib/drills/teacher/**` |
| G | speakasap/notification-service | `src/templates/drills/**`, `prisma/schema.prisma` (template seeds) |
| H | auth-microservice | `src/users/internal-users.controller.ts`, `src/users/users.service.ts` |
| I | speakasap/frontend + speakasap-portal | `app/auth/handoff/**`, `portal/platform_sso.py` |
| J | speakasap-portal | `cabinet/templates/**`, `cabinet/**/views/**` |
| K | orchestrating session only | deploys, migrations, verification |

**Shared-file exception:** Tracks A and B both edit a `prisma/schema.prisma`, but
in *different services*. They never collide. Tracks E and F both work in
`frontend/` but own disjoint directories; the one file both need,
`lib/drills/contracts.ts`, is created by Track 0 and is read-only thereafter.

---

## Execution Waves

Tracks inside a wave run in parallel. A wave starts only when the previous wave
has been reviewed and merged.

```
Wave 1  ─ Track 0 (foundation: tests, contracts, gateway routes)      [BLOCKING]
             │
Wave 2  ─ Track A (bank + vocabulary)   ┐
        ─ Track B (assignments+grading) ├─ parallel, no shared files
        ─ Track C (AI agents)           │
        ─ Track H (identity endpoint)   ┘
             │
Wave 3  ─ Track A2 (library: sets, search, ratings)  ┐ needs A
        ─ Track B2 (runner API, self-drill gate)     ├─ parallel
        ─ Track D (generation orchestration)         ┘ needs A,B,C
             │
Wave 4  ─ Track E (student runner UI)   ┐ needs B
        ─ Track F (teacher UI)          ├─ parallel
        ─ Track G (notifications)       │ needs B
        ─ Track I (SSO handoff)         ┘ needs H
             │
Wave 5  ─ Track J (legacy portal UI)      needs I, C8 endpoints
             │
Wave 6  ─ Track K (rollout, one deploy at a time, orchestrating session only)
```

**Critical path:** 0 → A → A2 → F. Start Track A first inside Wave 2.

---

## Per-Session Handoff Protocol

Each track runs in its own session. At the end of a track, write
`docs/superpowers/plans/2026-07-29-drilling-assignments/status/<track>.md`:

```markdown
# Track <X> — <name>

**State:** COMPLETE | BLOCKED | PARTIAL
**Commits:** <sha>..<sha>
**Contract changes:** none | <list — this invalidates other tracks, flag loudly>
**Deferred to orchestrator:** <deploys, migrations>
**Verification run:**
  - typecheck: <exact command> → <result>
  - tests: <exact command> → <N passed, M failed>
**Notes for the next track:** <what a consumer of this work needs to know>
```

Do not mark a track COMPLETE without pasting real command output into the
status file. A green check that never ran is worse than a red one.

---

## Track Index

| File | Track | Wave | Spec sections |
|---|---|---|---|
| [`01-foundation.md`](01-foundation.md) | 0 | 1 | Contracts, §9.6 gateway |
| [`02-content-bank.md`](02-content-bank.md) | A | 2 | §5, §6 |
| [`03-education-core.md`](03-education-core.md) | B | 2 | §9.1, §9.2, §9.4 |
| [`04-ai-agents.md`](04-ai-agents.md) | C | 2 | §7, §10.2 |
| [`05-identity.md`](05-identity.md) | H | 2 | §12 |
| [`06-library.md`](06-library.md) | A2 | 3 | §8 |
| [`07-orchestration.md`](07-orchestration.md) | D | 3 | §7.3, §10.1, §10.3 |
| [`08-runner-api.md`](08-runner-api.md) | B2 | 3 | §9.3, §9.5, §9.6 |
| [`09-frontend-learner.md`](09-frontend-learner.md) | E | 4 | §11.1 |
| [`10-frontend-teacher.md`](10-frontend-teacher.md) | F | 4 | §11.2 |
| [`11-notifications.md`](11-notifications.md) | G | 4 | §14 |
| [`12-sso-handoff.md`](12-sso-handoff.md) | I | 4 | §12.2 |
| [`13-legacy-ui.md`](13-legacy-ui.md) | J | 5 | §13 |
| [`14-rollout.md`](14-rollout.md) | K | 6 | §16 |
