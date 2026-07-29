# Track F — Teacher Wizard, Library and Review (Wave 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Where a teacher asks for a drill, watches it being built, finds an old one worth reusing, and approves what a student will see.

**Service:** `speakasap/frontend` · **Depends on:** Tracks A2, D · **Blocks:** nothing

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contracts C4, C5, C6), spec §11.2.

**You own:** `frontend/app/teacher/assignments/**`, `frontend/lib/drills/teacher/**`. Track E owns `app/learner/**` and `lib/drills/runner/**` — do not touch either. Vitest is installed repo-wide by Track 0 task 0.1; if `frontend/vitest.config.ts` is missing, Track 0 has not landed — stop and tell the orchestrator rather than installing it here.

**Hard rule for this whole track:** **no screen shows a score.** Not the review page, not the library rows, not the assignments list, not the lesson panel. Teachers see that work is done, what the sentences are, and whether validation flagged anything. `DrillAssignmentDTO` has no accuracy field; do not compute one client-side either.

---

### Task F.1: Teacher API client

**Files:**
- Create: `frontend/lib/drills/teacher/api.ts`
- Test: `frontend/lib/drills/teacher/api.test.ts`

**Interfaces:**
- Produces: `generateAssignments(req)`, `assignFromSet(req)`, `getAssignment(uuid)`, `listSets(query: DrillSetListQuery)`, `getSet(uuid)`, `updateSetItem(setUuid, itemId, patch)`, `deleteSetItem(setUuid, itemId)`, `regenerateItems(setUuid, itemIds, note?)`, `approveSet(setUuid)`, `rateSet(setUuid, value)`, `listTopics(languageCode, materialLanguage)`

- [ ] **Step 1: Write the failing test**

```ts
describe('listSets', () => {
  it('serializes topicSlugs as repeated query params', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sets: [], total: 0 }) });
    vi.stubGlobal('fetch', f);
    await listSets({ topicSlugs: ['prepositions', 'past-tense'] });
    expect(f.mock.calls[0][0]).toContain('topicSlugs=prepositions');
    expect(f.mock.calls[0][0]).toContain('topicSlugs=past-tense');
  });

  it('omits empty filters rather than sending blanks', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sets: [], total: 0 }) });
    vi.stubGlobal('fetch', f);
    await listSets({ q: '', courseKey: undefined });
    expect(f.mock.calls[0][0]).not.toContain('q=');
    expect(f.mock.calls[0][0]).not.toContain('courseKey=');
  });
});

describe('approveSet', () => {
  it('surfaces UNRESOLVED_VALIDATION_FAILURES as a typed error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 409,
      json: async () => ({ statusCode: 409, code: 'UNRESOLVED_VALIDATION_FAILURES',
                           message: '2 items still fail validation' }),
    }));
    await expect(approveSet('s-1')).rejects.toMatchObject({
      code: 'UNRESOLVED_VALIDATION_FAILURES',
    });
  });
});
```

- [ ] **Step 2: Implement, run, confirm PASS. Commit**

---

### Task F.2: Generation progress view

**Files:**
- Create: `frontend/lib/drills/teacher/GenerationProgress.tsx`
- Test: `frontend/lib/drills/teacher/GenerationProgress.test.tsx`

**Interfaces:**
- Consumes: `GenerationProgress` (contract C6)
- Produces: `<GenerationProgress assignmentUuid={...} onReady={...} />` — polls every 2 s

- [ ] **Step 1: Write the failing test**

```tsx
const progress = (over: Partial<GenerationProgress>): GenerationProgress => ({
  phase: 'GENERATING', generated: 23, total: 50, etaSeconds: 34,
  message: 'Generating sentences 23 of 50', stalled: false, ...over,
});

describe('GenerationProgress', () => {
  it('shows the phase in words, not a bare spinner', () => {
    render(<GenerationProgressView progress={progress({})} />);
    expect(screen.getByText(/generating sentences/i)).toBeInTheDocument();
  });

  it('shows the running count', () => {
    render(<GenerationProgressView progress={progress({})} />);
    expect(screen.getByText(/23.*50/)).toBeInTheDocument();
  });

  it('counts the estimate down', () => {
    render(<GenerationProgressView progress={progress({ etaSeconds: 34 })} />);
    expect(screen.getByText(/34\s*s/i)).toBeInTheDocument();
  });

  it('says it is taking longer than expected instead of showing 0s', () => {
    render(<GenerationProgressView progress={progress({ stalled: true, etaSeconds: 0 })} />);
    expect(screen.getByText(/longer than expected/i)).toBeInTheDocument();
    expect(screen.queryByText(/^0\s*s$/)).not.toBeInTheDocument();
  });

  it('shows an error and a retry when the phase is FAILED', async () => {
    const onRetry = vi.fn();
    render(<GenerationProgressView progress={progress({ phase: 'FAILED',
      message: 'AI service unavailable' })} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('calls onReady once when the phase reaches READY', () => {
    const onReady = vi.fn();
    const { rerender } = render(
      <GenerationProgress progress={progress({})} onReady={onReady} />);
    rerender(<GenerationProgress progress={progress({ phase: 'READY' })} onReady={onReady} />);
    rerender(<GenerationProgress progress={progress({ phase: 'READY' })} onReady={onReady} />);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('stops polling once terminal', async () => {
    const fetchSpy = vi.spyOn(api, 'getAssignment')
      .mockResolvedValue({ generationProgress: progress({ phase: 'READY' }) } as any);
    render(<GenerationProgress assignmentUuid="a-1" onReady={vi.fn()} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const callsAfterReady = fetchSpy.mock.calls.length;
    await new Promise((r) => setTimeout(r, 2500));
    expect(fetchSpy.mock.calls.length).toBe(callsAfterReady);
  });
});
```

Test 4 is the spec's "a stalled job says so rather than counting to zero and
lying" rule.

- [ ] **Step 2: Implement, run, confirm PASS (7 passed). Commit**

Items already generated are listed as they arrive, so the teacher can start
reading before the set finishes — render `items` from the polled assignment when
present.

---

### Task F.3: Creation wizard

**Files:**
- Create: `frontend/app/teacher/assignments/new/page.tsx`
- Create: `frontend/lib/drills/teacher/WizardWho.tsx`
- Create: `frontend/lib/drills/teacher/WizardWhat.tsx`
- Create: `frontend/lib/drills/teacher/TopicPicker.tsx`
- Test: `frontend/lib/drills/teacher/TopicPicker.test.tsx`
- Test: `frontend/lib/drills/teacher/WizardWhat.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
describe('TopicPicker', () => {
  it('shows the public grammar URL for a mapped topic', async () => {
    render(<TopicPicker topics={[{ slug: 'prepositions', title: 'Предлоги',
      publicUrl: 'https://speakasap.com/de/grammar/prepositions' } as any]}
      selected={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('link', { name: /prepositions/i }))
      .toHaveAttribute('href', 'https://speakasap.com/de/grammar/prepositions');
  });

  it('shows no link for an unmapped topic rather than a broken one', () => {
    render(<TopicPicker topics={[{ slug: 'x', title: 'X', publicUrl: null } as any]}
      selected={[]} onChange={vi.fn()} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('lets a teacher add a topic that does not exist yet, marked as new', async () => {
    const onChange = vi.fn();
    render(<TopicPicker topics={[]} selected={[]} onChange={onChange} allowCreate />);
    await userEvent.type(screen.getByRole('combobox'), 'subjunctive{Enter}');
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({
      slug: 'subjunctive', isNew: true,
    })]);
  });
});

describe('WizardWhat', () => {
  it('requires at least one topic or non-empty instructions before continuing', async () => {
    render(<WizardWhat onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('defaults the item count to 50 and accepts 1..200', async () => {
    render(<WizardWhat onNext={vi.fn()} />);
    const input = screen.getByLabelText(/number of exercises/i);
    expect(input).toHaveValue(50);
    await userEvent.clear(input);
    await userEvent.type(input, '500');
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });
});
```

Test 3 covers the spec's "a wholly new topic is generated end to end" case — the
teacher must be able to type a topic the taxonomy has never seen.

- [ ] **Step 2: Implement the three steps. Run, confirm PASS. Commit**

Step "Who" selects one student, several, or a group, plus an optional lesson
link. Step "What" is the topic picker, free-text instructions and item count.
Step "How" offers *Generate new* or *Pick from library*, then hands off to
`<GenerationProgress>`.

---

### Task F.4: Library browser

**Files:**
- Create: `frontend/app/teacher/assignments/library/page.tsx`
- Create: `frontend/lib/drills/teacher/LibraryBrowser.tsx`
- Test: `frontend/lib/drills/teacher/LibraryBrowser.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
describe('LibraryBrowser', () => {
  it('groups sets by lesson by default', () => {
    render(<LibraryBrowser sets={sets} groups={{ 'seven:german:ru#5': ['s-1', 's-2'],
      unassigned: ['s-3'] }} />);
    expect(screen.getByRole('group', { name: /lesson 5/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /unassigned/i })).toBeInTheDocument();
  });

  it('clears the lesson grouping when a search term is entered', async () => {
    const onQuery = vi.fn();
    render(<LibraryBrowser sets={sets} groups={{}} onQuery={onQuery} />);
    await userEvent.type(screen.getByRole('searchbox'), 'whale{Enter}');
    expect(onQuery).toHaveBeenCalledWith(expect.objectContaining({
      q: 'whale', courseKey: undefined, lessonOrder: undefined,
    }));
  });

  it('shows title, topics, item count, uses and star score — and NO accuracy', () => {
    render(<LibraryBrowser sets={[{ uuid: 's-1', title: 'Prepositions A2',
      topicSlugs: ['prepositions'], itemCount: 50, timesAssigned: 12,
      teacherUpvotes: 3, studentUpvotes: 8, popularityScore: 23 } as any]} groups={{}} />);
    expect(screen.getByText('Prepositions A2')).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.queryByText(/accuracy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('multi-selects sets and enables assign', async () => {
    render(<LibraryBrowser sets={sets} groups={{}} />);
    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('button', { name: /assign selected/i })).toBeEnabled();
  });
});
```

Test 3 enforces the no-score rule at the UI level, including the `%` sign — the
most likely way accuracy sneaks back in.

- [ ] **Step 2: Implement, run, confirm PASS. Commit**

---

### Task F.5: Review screen

**Files:**
- Create: `frontend/app/teacher/assignments/[uuid]/review/page.tsx`
- Create: `frontend/lib/drills/teacher/ReviewItem.tsx`
- Create: `frontend/lib/drills/teacher/ReviewList.tsx`
- Test: `frontend/lib/drills/teacher/ReviewList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
const items = [
  { id: 1, order: 0, validationState: 'PASS', validationIssues: [],
    item: { template: 'Ich warte [на]{auf} den Bus.', hint: null } },
  { id: 2, order: 1, validationState: 'FAIL',
    validationIssues: [{ code: 'OFF_TOPIC', message: 'Blank tests an article' }],
    item: { template: 'Ich sehe [die]{die} Schule.', hint: null } },
  { id: 3, order: 2, validationState: 'WARN',
    validationIssues: [{ code: 'WRONG_LEVEL', message: 'B1 vocabulary' }],
    item: { template: 'x [a]{b} y', hint: null } },
];

describe('ReviewList', () => {
  it('orders FAIL, then WARN, then PASS', () => {
    render(<ReviewList items={items as any} onApprove={vi.fn()} />);
    const headings = screen.getAllByTestId('review-item-state').map((n) => n.textContent);
    expect(headings).toEqual(['FAIL', 'WARN', 'PASS']);
  });

  it('shows the validation message next to the flagged item', () => {
    render(<ReviewList items={items as any} onApprove={vi.fn()} />);
    expect(screen.getByText('Blank tests an article')).toBeInTheDocument();
  });

  it('renders the sentence as the student will see it AND shows the answer to the teacher', () => {
    render(<ReviewList items={items as any} onApprove={vi.fn()} />);
    expect(screen.getByText(/Ich warte/)).toBeInTheDocument();
    expect(screen.getByText('auf')).toBeInTheDocument();
  });

  it('disables approve while any FAIL is unresolved', () => {
    render(<ReviewList items={items as any} onApprove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
  });

  it('enables approve once the FAIL is overridden', async () => {
    render(<ReviewList items={items as any} onApprove={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('button', { name: /keep anyway/i })[0]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled());
  });

  it('offers regenerate for a flagged item and batches the selection', async () => {
    const onRegenerate = vi.fn();
    render(<ReviewList items={items as any} onApprove={vi.fn()} onRegenerate={onRegenerate} />);
    await userEvent.click(screen.getByRole('button', { name: /regenerate all flagged/i }));
    expect(onRegenerate).toHaveBeenCalledWith([2, 3]);
  });

  it('shows no score anywhere', () => {
    render(<ReviewList items={items as any} onApprove={vi.fn()} />);
    expect(screen.queryByText(/accuracy|score|%/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement, run, confirm PASS (7 passed)**

Per item the teacher gets: **apply suggestion** (present only when the validator
returned a `suggestedFix`), **regenerate**, **edit**, **keep anyway**. "Keep
anyway" sets `validationState = 'OVERRIDDEN'` — recorded, never silent.

- [ ] **Step 3: Full suite, typecheck, commit**

```bash
cd /home/ssf/Documents/Github/speakasap/frontend
rtk npm test && rtk npm run typecheck
rtk git add app/teacher lib/drills/teacher
rtk git commit -m "feat(frontend): teacher wizard, library browser and review screen

Approve is blocked while any validation FAIL is unresolved. No screen in
this track displays a score.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track F completion checklist

- [ ] `rtk npm test` green, `rtk npm run typecheck` clean
- [ ] The no-score assertions pass in both the library and review tests
- [ ] Approve is provably disabled on unresolved FAIL and enabled after override
- [ ] The stalled-progress test passes
- [ ] Status file at `status/track-f.md`
