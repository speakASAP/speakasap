# Teacher sentence editing for drill assignments

Teachers can see full sentences on the progress screen, edit any sentence, add new ones by
typing or pasting text, and mark which words a student must fill in — on both the
pre-approval review screen and on a live assignment.

## Why

The progress screen (`/teacher/assignments/:uuid/progress`) renders only bare blank pairs
(`совещания → meeting`), so a teacher cannot judge whether a blank tests the right thing.
The sentence is already on the wire — `progressForTeacher` returns `items[].template`
(`education-service/src/drills/teacher/teacher-assignments.service.ts:434`) and the page
ignores it (`progress/page.tsx:132`).

Editing is worse than missing: `updateSetItem` and `deleteSetItem`
(`frontend/lib/drills/teacher/api.ts:167,178`) call `PATCH`/`DELETE
/drill-sets/:uuid/items/:itemId`, and **those routes do not exist** in content-service.
The `Edit` button in `ReviewItem.tsx:150` is dead wiring. Adding a sentence has no route
at all.

## Contract in play

Template markup is `[prompt]{answer}`, `DRILL_BLANK_PATTERN` in
`frontend/lib/drills/contracts.ts:36`, parsed identically on both sides
(`content-service/src/drills/template.ts:22`, `ReviewItem.tsx:47`).

    I live [за пределами]{outside} Moscow.

Sentences live in **two** places and editing them is two different code paths:

| Stage | Table | Service | Screen |
|---|---|---|---|
| Before approval | `DrillSetItem` | content-service | `/review` |
| After approval (copied) | `DrillAssignmentItem` (`education-service/prisma/schema.prisma:198`) | education-service | `/progress` |

## Decisions

1. **Editing a started sentence resets that sentence's attempts only.** A changed template
   invalidates attempts graded against the old blanks. Delete `DrillAttempt` rows for that
   `itemUuid`; leave every other sentence untouched.
2. **Both screens get add/edit/delete**, sharing one editor component.
3. **Blanks are marked by clicking words**, not by typing markup. Paste plain text → word
   chips → click a word → give its native-language prompt.

## Validation (shared, one module, both services)

Every sentence must satisfy all of these before it can be saved:

- at least one blank — a sentence with no blank is not a drill
- every blank has a non-empty answer (`EMPTY_ANSWER`)
- every blank has a non-empty prompt
- markup parses and leaves no residual `[`/`]`/`{`/`}` (`MARKUP_UNPARSEABLE`, `RESIDUAL_MARKUP`)
- non-empty text outside the blanks

Reuse the existing `ValidationIssueCode` union (`contracts.ts:132`) — no new codes.

## Scope boundaries

- **COMPLETED and CANCELLED are terminal** (`state-machine.ts:9`) with no outgoing edges.
  Editing there cannot reopen the assignment, so edits are rejected on terminal statuses
  with a clear message. Not a silent no-op.
- `blanksTotal` is derived from `blanks.length` (`assignments.repository.ts:148`), so any
  write MUST keep `template` and the `blanks` JSON in lockstep or the completion gate
  breaks and the student is blocked from self-drilling forever.
- No changes to the student runner payload; it stays answer-free.

---

## Task 1 — Shared sentence parsing + validation

**Files**
- `frontend/lib/drills/sentence-editing.ts` (new)
- `content-service/src/drills/sentence-validation.ts` (new)
- `education-service/src/drills/sentence-validation.ts` (new)

Pure functions, no I/O:

- `buildTemplate(words: {text, isBlank, prompt}[]): string` — chips → `[prompt]{answer}`
- `parseToWords(template: string): Word[]` — inverse, for editing an existing sentence
- `validateSentence(template: string): ValidationIssue[]` — the rules above
- `blanksFor(template: string): DrillBlank[]` — reuses `parseTemplate`

Server-side validation is authoritative and re-runs on every write. Client-side is for
immediate feedback only.

**Tests** — round-trip `buildTemplate ∘ parseToWords` is identity; each validation rule
rejects its own violation; a sentence with zero blanks is rejected; braces/brackets in the
teacher's pasted text do not produce a parseable-but-wrong template.

## Task 2 — content-service: set item routes

**File** `content-service/src/drills/sets/sets.controller.ts`, `sets.service.ts`

Add the three routes the frontend already calls, all `internal/` prefixed to match the
existing gating (`sets.controller.ts:87`):

- `PATCH internal/drill-sets/:uuid/items/:itemId` — `{ template?, hint?, validationState? }`
- `DELETE internal/drill-sets/:uuid/items/:itemId`
- `POST internal/drill-sets/:uuid/items` — append a sentence

On a template change: re-run `validateSentence`, recompute `blanks`, recompute the item
hash (`template.ts:48`), set `validationState` to `PASS` on clean teacher input (origin
`TEACHER`), reset `validatedAt`. Reject with 400 + `DrillErrorBody` when validation fails.
Refuse to delete the last remaining item — an empty set cannot be approved.

**Tests** in `sets.service.spec.ts` — patch recomputes blanks; invalid template is rejected
and nothing is written; delete of the final item is refused; add appends at `order = max+1`.

## Task 3 — education-service: assignment item routes

**File** `education-service/src/drills/drills.controller.ts`, `teacher-assignments.service.ts`

Three staff-gated routes beside the existing `teacher/progress/:uuid` (`drills.controller.ts:259`),
reusing `assertStaff` + `teacherIdForAssignment` ownership exactly as that route does:

- `PATCH drill-assignments/teacher/items/:itemUuid`
- `DELETE drill-assignments/teacher/items/:itemUuid`
- `POST drill-assignments/teacher/:uuid/items`

Each write, in one transaction:
1. Reject if the assignment status is terminal.
2. Validate the template; reject on any issue.
3. Write `template` **and** recomputed `blanks` together.
4. On edit/delete, delete `DrillAttempt` rows for that `itemUuid` (decision 1).
5. Log the edit at info with assignment uuid, item uuid, teacher id, attempts removed.

Recompute `firstTryAccuracy` after attempt deletion, or the stored scalar describes
attempts that no longer exist.

**Tests** in `teacher-assignments.service.spec.ts` — edit deletes only that item's attempts
and leaves siblings' intact; `countBlanks` stays consistent after add and delete; a
terminal-status edit is refused; a non-owning teacher gets 404, matching `progressForTeacher`.

## Task 4 — `<SentenceEditor/>` component

**File** `frontend/lib/drills/teacher/SentenceEditor.tsx` (new)

One component both screens mount. Two modes:

- **Edit one sentence** — loads existing template through `parseToWords`, chips pre-marked.
- **Add sentences** — a textarea; on paste/type, split into sentences, each becoming its own
  chip row. One paste can add many sentences.

Behaviour: click a word chip → it becomes a blank and reveals a small prompt input beside it.
Click again → back to plain word. Live preview renders exactly as `ReviewItem` does, so the
teacher sees what they will see after saving. Save is disabled while any sentence fails
validation, with the reason shown per sentence — never a silently inert button.

**Tests** — clicking marks a blank and emits the right template; a sentence with no blank
blocks save with a stated reason; prompt text is required once a word is marked; pasted
multi-line text yields one row per sentence; editing an existing template pre-marks its
blanks.

## Task 5 — Wire the progress page

**File** `frontend/app/teacher/assignments/[uuid]/progress/page.tsx`

Render `item.template` through the same segment renderer as `ReviewItem` so the full
sentence shows, with each blank's student state (`solved` / `revealed` / `not done` /
`tried: …`) attached to its blank inline rather than as a detached list. Add per-sentence
**Edit** and **Delete**, and an **Add sentence** control.

Keep the existing empty-state and PENDING_REVIEW messaging (`progress/page.tsx:98`) — it
already distinguishes "not approved yet" from "no sentences, which is a defect".

**Tests** — extend `progress/page.test.tsx`: the sentence text renders; an edit reflects
after save; the reset-attempts effect is visible in the counts.

## Task 6 — Wire the review page

**File** `frontend/app/teacher/assignments/[uuid]/review/page.tsx`, `teacher/ReviewItem.tsx`, `teacher/ReviewList.tsx`

Pass a real `onEdit` so the dead button (`ReviewItem.tsx:150`) opens `SentenceEditor`, and
surface Edit on every item rather than only flagged ones — a teacher may want to reword a
sentence that passed. Add **Add sentence** and **Delete**. `frontend/lib/drills/teacher/api.ts`
gains `createSetItem`; the existing `updateSetItem`/`deleteSetItem` finally reach real routes.

**Tests** — extend `ReviewList.test.tsx`: edit round-trips to `updateSetItem`; add appends;
approve stays blocked while any item fails validation (`sets.service.ts:204`).

## Task 7 — Verification

- `education-service` and `content-service`: `npm run typecheck` and their jest suites
  (never `npx tsc` — use `./node_modules/.bin/tsc`).
- `frontend`: `vitest run` and `npm run typecheck`.
- Confirm each new suite **fails** when the rule it tests is broken, before trusting a pass.
- Reproduce against the real assignment `a1748629-1f5a-4a9f-8ba5-262d6abc19fa`: sentences
  render, an edit persists, counts change to match the reset, and the student runner still
  serves no answers.
- Deploy is a separate serialized step: `../shared/scripts/deploy.sh speakasap`, taking the
  deploy lock, after the checks above pass.
