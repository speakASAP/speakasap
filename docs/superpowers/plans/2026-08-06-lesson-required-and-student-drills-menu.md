# Lesson-Required Assignments + Student Drills Menu

**Date:** 2026-08-06 · **Owner decision:** full scope, all three parts
**Repos:** `speakasap` (frontend, education-service), `speakasap-portal`

## Why

`/teacher/assignments/new` lets a teacher reach the wizard with no lesson and no
student. The field is literally labelled "Lesson (optional)" with a "No lesson"
option, and `WizardWho.tsx:99` gates submit only on `studentIds.length === 0`.

That is wrong on its own terms — a teacher assigns work *within* a lesson, and the
student roster is lesson-scoped (`roster.listForLesson`) — but it also corrupts
attribution. `drills.controller.ts:303`:

```ts
if (lessonUuid) {
  const scoped = await this.roster.listForLesson(lessonUuid);
  if (scoped.teacherId) return scoped.teacherId;   // Teacher profile pk
}
return this.identity.resolveStudentId(req.authUser!.id);  // legacy user id
```

With no lesson, `teacher_id` receives a **legacy user id** where every other row
holds a **Teacher profile pk** — two numbering spaces in one column. Worse,
`teacherIdForAssignment` derives the teacher *from the lesson*, so it returns
`null` and the ownership check that accepts "the lesson's teacher" has nothing to
match against.

Production has never taken this path: all 6 assignments have a lesson, all
`teacher_id = 182`, all `origin = TEACHER`. Unused, not safe.

Separately, self-drills hardcode `lessonUuid: null`
(`self-drill.service.ts:92`), so a student's own practice can never appear in a
lesson's homework.

## Scope

Three parts. Part 1 is the bug fix; 2 and 3 are the student-facing feature.

---

## Part 1 — TEACHER origin requires a lesson

**Contract change.** Per `00-MASTER.md` these invalidate other tracks and must be
flagged loudly. Flagged here: this narrows `lessonUuid` for TEACHER-origin creates
only. **SELF origin is unaffected by this part** — see Part 2, where SELF gains a
lesson by a different route.

### 1.1 Server (`education-service`) — the actual gate

`drills.controller.ts` create-assignment handler: reject a missing/null
`lessonUuid` with **400** before any work, rather than falling through to
`resolveStudentId`. A disabled button is not enforcement; Track J's portal and a
hand-crafted POST both reach this method.

```
400 { code: 'LESSON_REQUIRED',
      message: 'Choose a lesson before assigning drilling' }
```

Then delete the `resolveStudentId` fallback for TEACHER origin: once a lesson is
guaranteed, a lesson with no teacher is a data problem to surface, not to paper
over with a wrong-numbering-space id.

**TDD:** failing test first — POST with `lessonUuid: null` expects 400
`LESSON_REQUIRED`. Confirm it fails before implementing.

### 1.2 Contract (`shared/contracts/drills.contracts.ts`)

`lessonUuid: string` (not `| null`) on the TEACHER create payload. Re-vendor with
`shared/scripts/sync-drill-contracts.sh`.

Note: `content-service`'s `contracts.spec.ts` currently fails on a pre-existing
bad path (`../../../shared/` resolves to `speakasap/shared/`, script lives at
`Github/shared/`). Fix that path while here, or the drift check stays blind.

### 1.3 Wizard (`frontend/lib/drills/teacher/WizardWho.tsx`)

- Drop the `"No lesson"` option; relabel `Lesson (optional)` → `Lesson`.
- Extend the submit guard: `if (studentIds.length === 0 || !lessonUuid) return;`
- Disable **Next** while either is missing.

### 1.4 Bare URL (`frontend/app/teacher/assignments/new/page.tsx`)

With no `?lessonUuid=`, do not render the wizard at all. Render instead:

> **Choose a lesson first.** Open the lesson in the portal and use *Create
> drilling assignment* there — the student and lesson come with you.

with a link back to the portal's lessons list. This is the "even this URL should
not be available" requirement.

---

## Part 2 — Self-drills attach to the lesson they started from

`self-drill.service.ts:92` sets `lessonUuid: null` unconditionally.

- `startSelfDrill(studentId, setUuid)` → `startSelfDrill(studentId, setUuid, lessonUuid)`.
- Persist that `lessonUuid` on the row, so the self-drill shows in that lesson's
  homework alongside assigned work.
- `lessonUuid` stays **nullable in the column** — a drill started from the menu
  rather than from a lesson has none, and Part 3 allows exactly that.
- Keep all four existing gates unchanged: outstanding-assignment 409, set
  APPROVED, set not ahead of the student, `teacherId: null` + `origin: SELF`.

**TDD:** test that a self-drill started from a lesson persists that `lessonUuid`,
and that one started without a lesson still succeeds with null.

---

## Part 3 — Student drills menu (legacy portal)

Repo: `speakasap-portal`. The student lives here; this is where the menu is.

### 3.1 Menu entry

`cabinet/templates/student/base.html` — `INITIAL_STATE.menu` is a JS array
(`Мои курсы` / `Марафоны` / `Финансы` / `Профиль` / `Помощь` / `Книга`). Add:

```js
{ title: 'Тренировки', icon: 'pencil', url: '{% url 'student:drills' %}', key: 'drills' }
```

**Shown only when the student has drills.** Reuse
`drills_client.get_student_assignments(student_id)`, which already fails soft with
`unavailable: True` — on an outage the entry is simply absent rather than leading
to a broken page.

### 3.2 The page

New `student:drills` route + view + template:

- **Assigned to you** — outstanding work first. Each row links into the platform
  runner via the existing SSO handoff (Track I, live).
- **Your own practice** — approved sets the student may start, subject to the
  same server gate. Hidden when `selfDrillingAllowed` is false.
- Assignments that carry a `lessonUuid` show their lesson, so the menu and the
  homework tab agree. This is the intended duplication: same assignment, two
  entry points.
- Fail soft on `unavailable: True`, matching the existing panels.

### 3.3 Deploy constraint

**`ssh speakasap` is READ ONLY and I cannot deploy the portal.** Portal changes
ship via commit → push → `./scripts/deploy.sh` **run by the owner** on that host.
I will stop at "committed and pushed, ready to deploy" and say so.

---

## Order

1. Part 1.1 server test + fix (the real bug)
2. Part 1.2 contract + re-vendor
3. Part 1.3 / 1.4 wizard + bare URL
4. Part 2 self-drill lesson linking
5. Part 3 portal menu + page
6. Deploy `speakasap` services myself, one at a time; hand the portal deploy over

## Verification

- Each part TDD: failing test seen fail, then pass.
- `./node_modules/.bin/tsc --noEmit` per changed service (never `npx tsc`).
- Portal: `python3 -m py_compile` + its Django `TestCase` suites.
- Reproduce in the browser: bare `/teacher/assignments/new` shows the
  choose-a-lesson message; the prefilled portal link still works end to end.
- Re-check `drill_assignment` after: every TEACHER row still has a lesson, and
  `teacher_id` stays in the Teacher-profile numbering space.

## Risks

- **Contract change** — flagged per master plan. TEACHER-origin only.
- **Existing rows unaffected**: all 6 already have a lesson, so no backfill.
- The portal menu duplicates homework entry points by design (owner's call);
  both must resolve to the same assignment, never create a second one.
