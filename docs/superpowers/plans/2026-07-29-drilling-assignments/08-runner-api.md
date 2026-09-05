# Track B2 — Runner API and the Self-Drilling Gate (Wave 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The student-facing API — answer-free item delivery, server-side grading, server-decided completion, and the rule that teacher work comes first.

**Service:** `speakasap/education-service` · **Depends on:** Track B · **Blocks:** Tracks E, G

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contracts C6, C7), spec §9.3, §9.5, §9.6.

**You own:** `education-service/src/drills/runner/**` and `src/drills/drills.controller.ts`.

**The two rules this track exists to enforce.** Both are security properties, not features:
1. **No student-reachable response contains an answer.** The legacy portal ships answers in `data-answer` attributes; this does not.
2. **Self-drilling is blocked server-side while teacher work is outstanding.** Hiding the button is not enforcement.

---

### Task B2.1: Runner projection

**Files:**
- Create: `education-service/src/drills/runner/runner.projection.ts`
- Test: `education-service/src/drills/runner/runner.projection.spec.ts`

**Interfaces:**
- Consumes: `toSegments` (copied alongside `template.ts` in Track D — if Track D has not landed, copy `content-service/src/drills/template.ts` into `src/drills/runner/template.ts` and add the same byte-identity drift test)
- Produces: `toRunnerItem(item, attempts): RunnerItemDTO`, `toRunnerResponse(assignment, items, attempts): RunnerResponse`

- [ ] **Step 1: Write the failing test — leak protection first**

```ts
import { toRunnerItem, toRunnerResponse } from './runner.projection';

const item = {
  uuid: 'i-1', order: 0,
  template: 'Ich warte [на]{auf} den [x]{Bus}.',
  blanks: [
    { index: 0, prompt: 'на', answer: 'auf', alternatives: ['aufs'] },
    { index: 1, prompt: 'x', answer: 'Bus', alternatives: [] },
  ],
  hint: '(warten auf – ждать)',
};

describe('toRunnerItem', () => {
  it('NEVER includes an answer or an alternative anywhere in the payload', () => {
    const json = JSON.stringify(toRunnerItem(item as any, []));
    expect(json).not.toContain('auf');
    expect(json).not.toContain('aufs');
    expect(json).not.toContain('Bus');
  });

  it('exposes prompt and maxLength but not the answer text', () => {
    const r = toRunnerItem(item as any, []);
    expect(r.blanks[0]).toEqual({
      index: 0, prompt: 'на', maxLength: expect.any(Number),
      solved: false, solvedText: null,
    });
  });

  it('derives maxLength from the answer length with headroom, not the answer itself', () => {
    const r = toRunnerItem(item as any, []);
    expect(r.blanks[0].maxLength).toBeGreaterThanOrEqual('auf'.length);
    expect(r.blanks[0].maxLength).toBeLessThanOrEqual('auf'.length + 12);
  });

  it('returns segments with positional blanks only', () => {
    const r = toRunnerItem(item as any, []);
    expect(r.segments).toEqual([
      { type: 'text', value: 'Ich warte ' },
      { type: 'blank', index: 0 },
      { type: 'text', value: ' den ' },
      { type: 'blank', index: 1 },
      { type: 'text', value: '.' },
    ]);
  });

  it('marks a previously solved blank and echoes only what the student typed', () => {
    const attempts = [
      { itemUuid: 'i-1', blankIndex: 0, isCorrect: true, submittedValue: 'AUF' },
    ];
    const r = toRunnerItem(item as any, attempts as any);
    expect(r.blanks[0].solved).toBe(true);
    expect(r.blanks[0].solvedText).toBe('AUF');
  });

  it('does not mark a blank solved from an incorrect attempt', () => {
    const attempts = [
      { itemUuid: 'i-1', blankIndex: 0, isCorrect: false, submittedValue: 'bei' },
    ];
    const r = toRunnerItem(item as any, attempts as any);
    expect(r.blanks[0].solved).toBe(false);
    expect(r.blanks[0].solvedText).toBeNull();
  });

  it('keeps the hint, which is meant to be visible', () => {
    expect(toRunnerItem(item as any, []).hint).toBe('(warten auf – ждать)');
  });
});

describe('toRunnerResponse', () => {
  it('contains no answer string across the whole response', () => {
    const res = toRunnerResponse(
      { uuid: 'a-1', title: 't', status: 'ASSIGNED', createdAt: new Date(),
        resourceLinks: [], generationProgress: {}, items: [item] } as any,
      [item] as any, [],
    );
    const json = JSON.stringify(res);
    expect(json).not.toContain('"answer"');
    expect(json).not.toContain('alternatives');
  });
});
```

Test 1 asserts the substrings `auf`/`Bus` are absent. `auf` also appears inside
the prompt-free German text `Ich warte ` — it does not, but if a future template
makes that collision real, change the fixture, never the assertion.

- [ ] **Step 2: Run, confirm failure. Implement**

Build `RunnerBlankDTO` by explicit field list. `maxLength` is
`Math.max(answer.length, ...alternatives.map(a => a.length)) + 6` — headroom so
a slightly longer valid form still fits, without being a length oracle.

- [ ] **Step 3: Run, confirm PASS (8 passed)**

- [ ] **Step 4: Prove the leak test is real**

Temporarily add `answer: blank.answer` to the returned blank object. Tests 1, 2
and 8 must fail. Remove it. A leak test that would not catch a leak is worse
than no test.

- [ ] **Step 5: Commit**

```bash
rtk git add src/drills/runner/
rtk git commit -m "feat(education): answer-free runner projection

Verified by adding an answer field and watching three tests fail.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task B2.2: The check endpoint

**Files:**
- Create: `education-service/src/drills/runner/runner.service.ts`
- Test: `education-service/src/drills/runner/runner.service.spec.ts`

**Interfaces:**
- Consumes: `gradeBlank`, `gradingOptionsFor`, `assertTransition`, `countBlanks`
- Produces: `RunnerService.check(assignmentUuid, studentId, req: CheckBlankRequest): Promise<CheckBlankResponse>`

- [ ] **Step 1: Write the failing test**

```ts
describe('RunnerService.check', () => {
  it('grades server-side and returns the accepted text', async () => {
    const r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    expect(r.correct).toBe(true);
    expect(r.acceptedText).toBe('auf');
  });

  it('returns no accepted text on a wrong answer', async () => {
    const r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'bei' });
    expect(r).toMatchObject({ correct: false, acceptedText: null });
  });

  it('records every attempt with an incrementing attemptNo', async () => {
    await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'bei' });
    await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    expect(prisma.drillAttempt.create).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ data: expect.objectContaining({ attemptNo: 2 }) }));
  });

  it('moves ASSIGNED to IN_PROGRESS on the first attempt', async () => {
    assignment.status = 'ASSIGNED';
    await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'x' });
    expect(prisma.drillAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'IN_PROGRESS' }) }));
  });

  it('completes the assignment only when the server counts every blank correct', async () => {
    counts.blanksCorrect = 9; counts.blanksTotal = 10;
    let r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'wrong' });
    expect(r.assignmentCompleted).toBe(false);

    counts.blanksCorrect = 10;
    r = await svc.check('a-1', 42, { itemUuid: 'i-2', blankIndex: 0, value: 'auf' });
    expect(r.assignmentCompleted).toBe(true);
  });

  it('refuses a check against another student assignment', async () => {
    await expect(svc.check('a-1', 999, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' }))
      .rejects.toThrow(/forbidden|not found/i);
  });

  it('refuses a check on a COMPLETED assignment', async () => {
    assignment.status = 'COMPLETED';
    await expect(svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' }))
      .rejects.toThrow();
  });

  it('refuses a blankIndex that does not exist on the item', async () => {
    await expect(svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 99, value: 'x' }))
      .rejects.toThrow(/blankIndex/i);
  });

  it('is idempotent on an already-solved blank — no duplicate completion', async () => {
    await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    const r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    expect(r.correct).toBe(true);
    expect(prisma.drillAssignment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }));
  });
});
```

- [ ] **Step 2: Run, confirm failure. Implement**

Completion is recomputed from `countBlanks` **after** persisting the attempt —
never inferred from the client's view. `firstTryAccuracy` is written here as
`(blanks correct on attemptNo === 1) / blanksTotal`, and item counters
(`timesShown`, `timesCorrectFirstTry`) are pushed to content-service. Neither is
returned to any caller.

- [ ] **Step 3: Run, confirm PASS (9 passed). Commit**

---

### Task B2.3: The self-drilling gate

**Files:**
- Create: `education-service/src/drills/runner/self-drill.service.ts`
- Test: `education-service/src/drills/runner/self-drill.service.spec.ts`

**Interfaces:**
- Produces: `SelfDrillService.startSelfDrill(studentId, setUuid): Promise<DrillAssignmentDTO>`

- [ ] **Step 1: Write the failing test**

```ts
import { ConflictException, ForbiddenException } from '@nestjs/common';

describe('SelfDrillService.startSelfDrill', () => {
  it('refuses with 409 and names the blocking assignment when work is ASSIGNED', async () => {
    repo.findOutstanding.mockResolvedValue({ uuid: 'blocking-1', status: 'ASSIGNED' });
    await expect(svc.startSelfDrill(42, 's-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ASSIGNMENT_OUTSTANDING', blockingAssignmentUuid: 'blocking-1',
      }),
    });
  });

  it('refuses when work is IN_PROGRESS', async () => {
    repo.findOutstanding.mockResolvedValue({ uuid: 'blocking-2', status: 'IN_PROGRESS' });
    await expect(svc.startSelfDrill(42, 's-1')).rejects.toThrow(ConflictException);
  });

  it('allows when nothing is outstanding', async () => {
    repo.findOutstanding.mockResolvedValue(null);
    content.getSet.mockResolvedValue(approvedSet());
    await expect(svc.startSelfDrill(42, 's-1')).resolves.toBeDefined();
  });

  it('ignores COMPLETED and CANCELLED work when deciding', async () => {
    repo.findOutstanding.mockResolvedValue(null);
    content.getSet.mockResolvedValue(approvedSet());
    await svc.startSelfDrill(42, 's-1');
    expect(repo.findOutstanding).toHaveBeenCalledWith(42);
  });

  it('refuses an unapproved set', async () => {
    repo.findOutstanding.mockResolvedValue(null);
    content.getSet.mockResolvedValue({ ...approvedSet(), reviewState: 'PENDING_REVIEW' });
    await expect(svc.startSelfDrill(42, 's-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SET_NOT_APPROVED' }),
    });
  });

  it('refuses a set beyond the student current lesson', async () => {
    repo.findOutstanding.mockResolvedValue(null);
    studentProgress.lessonOrder = 4;
    content.getSet.mockResolvedValue({ ...approvedSet(), lessonOrder: 9 });
    await expect(svc.startSelfDrill(42, 's-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SET_AHEAD_OF_STUDENT' }),
    });
  });

  it('creates the assignment with teacherId null and origin SELF', async () => {
    repo.findOutstanding.mockResolvedValue(null);
    content.getSet.mockResolvedValue(approvedSet());
    await svc.startSelfDrill(42, 's-1');
    expect(prisma.drillAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        teacherId: null, origin: 'SELF', status: 'ASSIGNED',
      }) }));
  });

  it('increments timesSelfSelected on the set', async () => {
    repo.findOutstanding.mockResolvedValue(null);
    content.getSet.mockResolvedValue(approvedSet());
    await svc.startSelfDrill(42, 's-1');
    expect(content.incrementSelfSelected).toHaveBeenCalledWith('s-1');
  });
});
```

- [ ] **Step 2: Run, confirm failure. Implement, run, confirm PASS (8 passed)**

- [ ] **Step 3: Prove the gate cannot be bypassed**

Write one extra test that calls `startSelfDrill` **without** consulting any UI
state, with `findOutstanding` returning a row, and asserts it still throws. Then
temporarily comment out the gate check and confirm all six refusal tests fail.
Restore.

- [ ] **Step 4: Commit**

```bash
rtk git add src/drills/runner/self-drill.service.ts src/drills/runner/self-drill.service.spec.ts
rtk git commit -m "feat(education): server-side self-drilling gate

409 with the blocking assignment uuid while teacher work is outstanding.
Verified by disabling the check and watching every refusal test fail.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task B2.4: Controller and internal endpoints

**Files:**
- Create: `education-service/src/drills/drills.controller.ts`
- Create: `education-service/src/drills/internal-drills.controller.ts`
- Create: `education-service/src/drills/drills.module.ts`
- Modify: `education-service/src/app.module.ts`
- Test: `education-service/src/drills/drills.controller.spec.ts`

**Interfaces:**
- Produces: every route in spec §9.6, plus the three internal endpoints in contract C8.

- [ ] **Step 1: Write the failing controller test**

Assert, at minimum:
- `GET /runner` is reachable by the owning student and **not** by another student
- `GET /runner` response contains no answer (repeat the leak assertion at the HTTP layer — projection tests do not prove the controller did not add fields back)
- `POST /self` surfaces the 409 body shape from contract C7 including `blockingAssignmentUuid`
- teacher-only routes reject a student-role token
- the three service-to-service routes require an Auth-issued service credential and declare their allowed service roles, per the sole canonical [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](../../../../../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md)
- `InternalStudentAssignmentsResponse.selfDrillingAllowed` is `false` when an assignment is outstanding, mirroring the gate exactly

That last one matters: Track J renders the legacy dashboard from this flag. If it
disagrees with the gate, the portal offers a button that 409s.

- [ ] **Step 2: Implement, run, confirm PASS**

- [ ] **Step 3: Full suite, typecheck, commit**

```bash
cd /home/ssf/Documents/Github/speakasap/education-service
rtk npm test && rtk npm run typecheck
rtk git add src/drills/ src/app.module.ts
rtk git commit -m "feat(education): drill runner and internal assignment endpoints

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track B2 completion checklist

- [ ] `rtk npm test` green, `rtk npm run typecheck` clean
- [ ] Answer-leak falsification performed at both the projection and controller layers
- [ ] Self-drill gate falsification performed
- [ ] `selfDrillingAllowed` provably matches the gate
- [ ] Status file at `status/track-b2.md`
