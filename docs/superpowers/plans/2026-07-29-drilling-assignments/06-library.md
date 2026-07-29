# Track A2 — Drill Library: Sets, Search, Ratings (Wave 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make drills reusable — a searchable, rateable library of vetted sets grouped by lesson.

**Service:** `speakasap/content-service` · **Depends on:** Track A · **Blocks:** Tracks D, F

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contract C4), spec §8.

**You own:** `content-service/src/drills/sets/**`, plus the set models in `content-service/prisma/schema.prisma`. Track A has finished with that file; you are now its sole writer.

---

### Task A2.1: Set, item and rating models

**Files:**
- Modify: `content-service/prisma/schema.prisma`

- [ ] **Step 1: Append the models** exactly as specified in spec §8.1 (`DrillSet`, `DrillSetItem`, `DrillSetRating`), with `@@map("drill_set")`, `@@map("drill_set_item")`, `@@map("drill_set_rating")`.

- [ ] **Step 2: Add the full-text index**

Prisma cannot express a GIN tsvector index, so add it by hand to the generated
migration SQL after `prisma migrate dev --create-only`:

```sql
CREATE INDEX drill_set_searchtext_idx
  ON drill_set
  USING GIN (to_tsvector('simple', "searchText"));
```

`'simple'` rather than a language-specific configuration is deliberate: the
corpus spans 16 languages and no single stemmer is right for all of them.
Substring recall matters more here than stemming.

- [ ] **Step 3: Validate, generate, typecheck, commit** (migration created, not applied)

---

### Task A2.2: Popularity scoring

**Files:**
- Create: `content-service/src/drills/sets/popularity.ts`
- Test: `content-service/src/drills/sets/popularity.spec.ts`

**Interfaces:**
- Produces: `computePopularityScore(input: PopularityInput): number`
  ```ts
  export interface PopularityInput {
    teacherUpvotes: number; studentUpvotes: number;
    timesAssigned: number; timesSelfSelected: number;
    reviewState: DrillSetReviewState;
  }
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { computePopularityScore } from './popularity';

const base = {
  teacherUpvotes: 0, studentUpvotes: 0, timesAssigned: 0,
  timesSelfSelected: 0, reviewState: 'APPROVED' as const,
};

describe('computePopularityScore', () => {
  it('weights a teacher vote three times a student vote', () => {
    const teacher = computePopularityScore({ ...base, teacherUpvotes: 1 });
    const student = computePopularityScore({ ...base, studentUpvotes: 1 });
    expect(teacher).toBe(3);
    expect(student).toBe(1);
  });

  it('counts usage at half a point, capped at 20 uses', () => {
    expect(computePopularityScore({ ...base, timesAssigned: 10 })).toBe(5);
    expect(computePopularityScore({ ...base, timesAssigned: 100 })).toBe(10);
    expect(computePopularityScore({ ...base, timesAssigned: 15, timesSelfSelected: 15 })).toBe(10);
  });

  it('subtracts five while the set is not approved', () => {
    expect(computePopularityScore({ ...base, teacherUpvotes: 1, reviewState: 'PENDING_REVIEW' }))
      .toBe(-2);
  });

  it('lets downvotes push a score negative', () => {
    expect(computePopularityScore({ ...base, teacherUpvotes: -2 })).toBe(-6);
  });

  it('ranks an approved zero-vote set above an unapproved well-voted one', () => {
    const approved = computePopularityScore(base);
    const pending = computePopularityScore({
      ...base, teacherUpvotes: 1, reviewState: 'PENDING_REVIEW',
    });
    expect(approved).toBeGreaterThan(pending);
  });
});
```

- [ ] **Step 2: Run, confirm failure. Implement**

```ts
import { DrillSetReviewState } from '../contracts';

export interface PopularityInput {
  teacherUpvotes: number;
  studentUpvotes: number;
  timesAssigned: number;
  timesSelfSelected: number;
  reviewState: DrillSetReviewState;
}

export function computePopularityScore(input: PopularityInput): number {
  const usage = Math.min(input.timesAssigned + input.timesSelfSelected, 20);
  const unapprovedPenalty = input.reviewState === 'APPROVED' ? 0 : 5;
  return 3 * input.teacherUpvotes + 1 * input.studentUpvotes + 0.5 * usage - unapprovedPenalty;
}
```

- [ ] **Step 3: Run, confirm PASS (5 passed). Commit**

---

### Task A2.3: Sets service — create, read, approve

**Files:**
- Create: `content-service/src/drills/sets/sets.service.ts`
- Create: `content-service/src/drills/sets/sets.module.ts`
- Test: `content-service/src/drills/sets/sets.service.spec.ts`

**Interfaces:**
- Produces:
  - `createSet(input): Promise<DrillSetDetailDTO>`
  - `getSet(uuid): Promise<DrillSetDetailDTO>` — includes answers, teacher-only
  - `approveSet(uuid, teacherId): Promise<DrillSetDTO>`
  - `recordRating(uuid, raterType, raterId, value, comment?): Promise<DrillSetDTO>`
  - `updateSearchText(uuid): Promise<void>`

- [ ] **Step 1: Write the failing tests — the approval gate is the point**

```ts
import { ConflictException } from '@nestjs/common';
import { SetsService } from './sets.service';

const prisma = {
  drillSet: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  drillSetItem: { findMany: jest.fn() },
  drillSetRating: { upsert: jest.fn() },
  $transaction: jest.fn(async (fn: any) => fn(prisma)),
} as any;

describe('SetsService.approveSet', () => {
  beforeEach(() => jest.resetAllMocks());

  it('refuses approval while any item is FAIL', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1', reviewState: 'PENDING_REVIEW',
      items: [
        { id: 1, validationState: 'PASS' },
        { id: 2, validationState: 'FAIL' },
      ],
    });
    const svc = new SetsService(prisma);
    await expect(svc.approveSet('s-1', 7)).rejects.toThrow(ConflictException);
  });

  it('allows approval when the only issues are WARN', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1', reviewState: 'PENDING_REVIEW',
      items: [{ id: 1, validationState: 'WARN' }, { id: 2, validationState: 'PASS' }],
    });
    prisma.drillSet.update.mockResolvedValue({ uuid: 's-1', reviewState: 'APPROVED' });
    const svc = new SetsService(prisma);
    await expect(svc.approveSet('s-1', 7)).resolves.toBeDefined();
  });

  it('allows approval when a FAIL has been explicitly overridden', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1', reviewState: 'PENDING_REVIEW',
      items: [{ id: 1, validationState: 'OVERRIDDEN' }],
    });
    prisma.drillSet.update.mockResolvedValue({ uuid: 's-1', reviewState: 'APPROVED' });
    const svc = new SetsService(prisma);
    await expect(svc.approveSet('s-1', 7)).resolves.toBeDefined();
  });

  it('recomputes popularity on approval so the unapproved penalty lifts', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1', reviewState: 'PENDING_REVIEW', items: [],
      teacherUpvotes: 1, studentUpvotes: 0, timesAssigned: 0, timesSelfSelected: 0,
    });
    prisma.drillSet.update.mockResolvedValue({ uuid: 's-1', reviewState: 'APPROVED' });
    const svc = new SetsService(prisma);
    await svc.approveSet('s-1', 7);
    expect(prisma.drillSet.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ popularityScore: 3 }) }),
    );
  });

  it('is idempotent — approving an approved set does not throw', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1', reviewState: 'APPROVED', items: [],
      teacherUpvotes: 0, studentUpvotes: 0, timesAssigned: 0, timesSelfSelected: 0,
    });
    prisma.drillSet.update.mockResolvedValue({ uuid: 's-1', reviewState: 'APPROVED' });
    const svc = new SetsService(prisma);
    await expect(svc.approveSet('s-1', 7)).resolves.toBeDefined();
  });
});

describe('SetsService.recordRating', () => {
  it('upserts on (set, raterType, raterId) so a rater can change their vote', async () => {
    prisma.drillSetRating.upsert.mockResolvedValue({});
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1', reviewState: 'APPROVED', items: [],
      teacherUpvotes: 0, studentUpvotes: 0, timesAssigned: 0, timesSelfSelected: 0,
    });
    prisma.drillSet.update.mockResolvedValue({});
    const svc = new SetsService(prisma);
    await svc.recordRating('s-1', 'TEACHER', 7, 1);
    expect(prisma.drillSetRating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { setUuid_raterType_raterId: { setUuid: 's-1', raterType: 'TEACHER', raterId: 7 } },
      }),
    );
  });

  it('rejects a rating value other than +1 or -1', async () => {
    const svc = new SetsService(prisma);
    await expect(svc.recordRating('s-1', 'STUDENT', 42, 5 as any)).rejects.toThrow(/value/i);
  });
});
```

- [ ] **Step 2: Run, confirm failure. Implement**

`approveSet` logic, in order: load the set with items; if any
`validationState === 'FAIL'`, throw `ConflictException` with code
`UNRESOLVED_VALIDATION_FAILURES` (contract C7); otherwise set
`reviewState = 'APPROVED'`, `approvedAt = now()`, and recompute
`popularityScore` with `computePopularityScore`.

`recordRating` validates `value ∈ {1, -1}`, upserts the rating, recounts
`teacherUpvotes`/`studentUpvotes` as `SUM(value)` per rater type, and recomputes
the score in the same transaction.

- [ ] **Step 3: Run, confirm PASS (7 passed). Commit**

---

### Task A2.4: Library search and grouping

**Files:**
- Create: `content-service/src/drills/sets/sets.query.ts`
- Test: `content-service/src/drills/sets/sets.query.spec.ts`

**Interfaces:**
- Produces: `buildSetListQuery(q: DrillSetListQuery): { where: Prisma.DrillSetWhereInput; orderBy: unknown; take: number; skip: number }` and `groupByLesson(sets: DrillSetDTO[]): Record<string, string[]>`

- [ ] **Step 1: Write the failing test — the search-ignores-lesson rule is the point**

```ts
import { buildSetListQuery, groupByLesson } from './sets.query';

describe('buildSetListQuery', () => {
  it('filters by course and lesson when no search term is given', () => {
    const { where } = buildSetListQuery({ courseKey: 'seven:german:ru', lessonOrder: 5 });
    expect(where).toMatchObject({ courseKey: 'seven:german:ru', lessonOrder: 5 });
  });

  it('DROPS the course and lesson filters when a search term is given', () => {
    const { where } = buildSetListQuery({
      courseKey: 'seven:german:ru', lessonOrder: 5, q: 'whale elephant',
    });
    expect(where).not.toHaveProperty('courseKey');
    expect(where).not.toHaveProperty('lessonOrder');
  });

  it('sorts by popularity descending by default', () => {
    const { orderBy } = buildSetListQuery({});
    expect(orderBy).toEqual([{ popularityScore: 'desc' }, { createdAt: 'desc' }]);
  });

  it('sorts by recency when asked', () => {
    const { orderBy } = buildSetListQuery({ sort: 'recent' });
    expect(orderBy).toEqual([{ createdAt: 'desc' }]);
  });

  it('caps limit at 100 and defaults to 25', () => {
    expect(buildSetListQuery({}).take).toBe(25);
    expect(buildSetListQuery({ limit: 5000 }).take).toBe(100);
  });

  it('omits an empty topicSlugs filter rather than matching nothing', () => {
    const { where } = buildSetListQuery({ topicSlugs: [] });
    expect(where).not.toHaveProperty('topicSlugs');
  });
});

describe('groupByLesson', () => {
  it('buckets by courseKey and lessonOrder, with an unassigned bucket', () => {
    const groups = groupByLesson([
      { uuid: 'a', courseKey: 'seven:german:ru', lessonOrder: 5 },
      { uuid: 'b', courseKey: 'seven:german:ru', lessonOrder: 5 },
      { uuid: 'c', courseKey: null, lessonOrder: null },
    ] as any);
    expect(groups['seven:german:ru#5']).toEqual(['a', 'b']);
    expect(groups['unassigned']).toEqual(['c']);
  });
});
```

The second test is the whole point of the feature request: a teacher who
remembers a sentence but not which lesson it came from must still find it.
Filtering by lesson while searching would defeat that.

- [ ] **Step 2: Run, confirm failure. Implement**

The `q` branch uses a raw fragment against the GIN index:

```ts
where.AND = [{
  searchText: { search: q.split(/\s+/).filter(Boolean).join(' & ') },
}];
```

If the installed Prisma version does not support `search` on this provider, fall
back to `contains` with `mode: 'insensitive'` and record that in the status file
— it is slower but correct, and correctness ships first.

- [ ] **Step 3: Run, confirm PASS (7 passed). Commit**

---

### Task A2.5: Sets controller and the student-facing library

**Files:**
- Create: `content-service/src/drills/sets/sets.controller.ts`
- Test: `content-service/src/drills/sets/sets.controller.spec.ts`

**Interfaces:**
- Produces every route in spec §8.3.

- [ ] **Step 1: Write the failing test — the student-visibility rule**

```ts
describe('GET /api/v1/drill-sets/available-for-me', () => {
  it('returns only APPROVED sets', async () => {
    await controller.availableForMe(studentReq({ courseKey: 'seven:german:ru', lessonOrder: 4 }));
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ reviewState: 'APPROVED' }),
    );
  });

  it('never returns a set beyond the student current lesson', async () => {
    await controller.availableForMe(studentReq({ courseKey: 'seven:german:ru', lessonOrder: 4 }));
    const arg = service.list.mock.calls[0][0];
    expect(arg.maxLessonOrder).toBe(4);
  });

  it('never returns answers', async () => {
    service.list.mockResolvedValue({ sets: [{ uuid: 's', title: 't' }], total: 1 });
    const res = await controller.availableForMe(studentReq({}));
    expect(JSON.stringify(res)).not.toContain('answer');
  });
});
```

- [ ] **Step 2: Implement, run, confirm PASS**

`GET /drill-sets/:uuid` returns `DrillSetDetailDTO` **including answers** and
must be guarded so only staff reach it. Use the existing staff guard —
`education-service/src/shared/staff-access.ts` shows the ecosystem's pattern;
find content-service's equivalent and use it. Never expose the detail route to a
student-role token.

- [ ] **Step 3: Run the full suite, typecheck, commit**

```bash
cd /home/ssf/Documents/Github/speakasap/content-service
rtk npm test && rtk npm run typecheck
rtk git add src/drills/sets/ src/app.module.ts prisma/
rtk git commit -m "feat(content): drill library with search, grouping and ratings

Search deliberately ignores the lesson filter so a teacher can find a
good set from a different lesson by recalling one of its sentences.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track A2 completion checklist

- [ ] `rtk npm test` green, `rtk npm run typecheck` clean
- [ ] GIN index present in the migration SQL
- [ ] Approval refuses on FAIL, permits on WARN and OVERRIDDEN — all three tested
- [ ] Search-ignores-lesson test passing
- [ ] Status file at `status/track-a2.md`
