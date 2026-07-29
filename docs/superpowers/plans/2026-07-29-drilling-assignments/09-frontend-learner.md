# Track E — Student Runner UI (Wave 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The drill runner — type into a blank, and if it is right it becomes part of the sentence instantly.

**Service:** `speakasap/frontend` (Next.js App Router) · **Depends on:** Track B2 · **Blocks:** nothing

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contract C6), spec §11.1.

**You own:** `frontend/app/learner/practice/**`, `frontend/lib/drills/runner/**`. Track F owns `app/teacher/**` — do not touch it. `frontend/lib/drills/contracts.ts` is read-only (Track 0 owns it).

---

### Task E.1: Confirm the frontend test runner works

Vitest and testing-library were installed repo-wide by **Track 0 task 0.1**
(steps 4, 5 and 8). This task is a two-minute confirmation, not a setup.

- [ ] **Step 1: Confirm the tooling is present**

```bash
cd /home/ssf/Documents/Github/speakasap/frontend
rtk ls vitest.config.ts vitest.setup.ts
rtk npm test
rtk npm run typecheck
```

Expected: `vitest run` executes and reports zero test files (the correct empty
state), and typecheck is clean.

If either file is missing, Track 0 has not landed. **Stop and tell the
orchestrator** rather than installing it yourself — doing it here would create a
second, divergent config and a lockfile conflict with Track 0's commit.

---

### Task E.2: API client

**Files:**
- Create: `frontend/lib/drills/runner/api.ts`
- Test: `frontend/lib/drills/runner/api.test.ts`

**Interfaces:**
- Produces: `fetchRunner(uuid)`, `checkBlank(uuid, req: CheckBlankRequest)`, `revealBlank(uuid, itemUuid, blankIndex)`, `rateAssignment(uuid, value)`, `listMyAssignments()`, `startSelfDrill(setUuid)`

- [ ] **Step 1: Write the failing test**

```ts
import { checkBlank, startSelfDrill } from './api';

describe('checkBlank', () => {
  it('posts to the gateway path with the session token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ correct: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await checkBlank('a-1', { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/drill-assignments/a-1/check');
  });

  it('throws a typed NetworkError on a transport failure so the UI can say "not saved"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(checkBlank('a-1', { itemUuid: 'i', blankIndex: 0, value: 'x' }))
      .rejects.toMatchObject({ name: 'NetworkError' });
  });
});

describe('startSelfDrill', () => {
  it('surfaces the 409 code and blocking assignment rather than a generic error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 409,
      json: async () => ({ statusCode: 409, code: 'ASSIGNMENT_OUTSTANDING',
                           message: 'finish your assignment', blockingAssignmentUuid: 'b-1' }),
    }));
    await expect(startSelfDrill('s-1')).rejects.toMatchObject({
      code: 'ASSIGNMENT_OUTSTANDING', blockingAssignmentUuid: 'b-1',
    });
  });
});
```

- [ ] **Step 2: Implement, run, confirm PASS. Commit**

---

### Task E.3: The `DrillRunner` component

The centrepiece. Everything else in this track is scaffolding around it.

**Files:**
- Create: `frontend/lib/drills/runner/DrillRunner.tsx`
- Create: `frontend/lib/drills/runner/DrillBlank.tsx`
- Test: `frontend/lib/drills/runner/DrillRunner.test.tsx`

**Interfaces:**
- Consumes: `RunnerResponse`, `RunnerItemDTO`, `CheckBlankResponse`, the API client
- Produces: `<DrillRunner assignment={...} items={...} onComplete={...} />`

- [ ] **Step 1: Write the failing tests — behaviour, not markup**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrillRunner } from './DrillRunner';
import * as api from './api';

const items = [{
  uuid: 'i-1', order: 0,
  segments: [
    { type: 'text', value: 'Ich warte ' },
    { type: 'blank', index: 0 },
    { type: 'text', value: ' den Bus.' },
  ],
  blanks: [{ index: 0, prompt: 'на', maxLength: 9, solved: false, solvedText: null }],
  hint: '(warten auf – ждать)',
}];

const assignment = { uuid: 'a-1', title: 'Prepositions', blanksCorrect: 0, blanksTotal: 1 } as any;

describe('DrillRunner', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders a blank as an input with the prompt as placeholder', () => {
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);
    expect(screen.getByPlaceholderText('на')).toBeInTheDocument();
  });

  it('replaces the input with resolved text when the answer is correct', async () => {
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: true, acceptedText: 'auf', attemptNo: 1,
      blanksCorrect: 1, blanksTotal: 1, assignmentCompleted: true,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('на'), 'auf{Enter}');
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('на')).not.toBeInTheDocument();
      expect(screen.getByText('auf')).toBeInTheDocument();
    });
  });

  it('keeps the input editable and marks it wrong on an incorrect answer', async () => {
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: false, acceptedText: null, attemptNo: 1,
      blanksCorrect: 0, blanksTotal: 1, assignmentCompleted: false,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);
    const input = screen.getByPlaceholderText('на');
    await userEvent.type(input, 'bei{Enter}');
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(input).toBeEnabled();
  });

  it('allows unlimited retries after a wrong answer', async () => {
    const spy = vi.spyOn(api, 'checkBlank')
      .mockResolvedValueOnce({ correct: false, acceptedText: null, attemptNo: 1,
        blanksCorrect: 0, blanksTotal: 1, assignmentCompleted: false })
      .mockResolvedValueOnce({ correct: false, acceptedText: null, attemptNo: 2,
        blanksCorrect: 0, blanksTotal: 1, assignmentCompleted: false })
      .mockResolvedValueOnce({ correct: true, acceptedText: 'auf', attemptNo: 3,
        blanksCorrect: 1, blanksTotal: 1, assignmentCompleted: true });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);
    const input = screen.getByPlaceholderText('на');
    await userEvent.type(input, 'a{Enter}');
    await userEvent.clear(input);
    await userEvent.type(input, 'b{Enter}');
    await userEvent.clear(input);
    await userEvent.type(input, 'auf{Enter}');
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(3));
  });

  it('calls onComplete exactly once, and only when the SERVER says completed', async () => {
    const onComplete = vi.fn();
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: true, acceptedText: 'auf', attemptNo: 1,
      blanksCorrect: 1, blanksTotal: 1, assignmentCompleted: false,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={onComplete} />);
    await userEvent.type(screen.getByPlaceholderText('на'), 'auf{Enter}');
    await waitFor(() => expect(screen.getByText('auf')).toBeInTheDocument());
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows "not saved" rather than marking wrong when the network fails', async () => {
    vi.spyOn(api, 'checkBlank').mockRejectedValue(
      Object.assign(new Error('offline'), { name: 'NetworkError' }));
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);
    const input = screen.getByPlaceholderText('на');
    await userEvent.type(input, 'auf{Enter}');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/not saved/i));
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('renders an already-solved blank as text on mount', () => {
    const solved = [{ ...items[0],
      blanks: [{ index: 0, prompt: 'на', maxLength: 9, solved: true, solvedText: 'auf' }] }];
    render(<DrillRunner assignment={assignment} items={solved as any} onComplete={vi.fn()} />);
    expect(screen.queryByPlaceholderText('на')).not.toBeInTheDocument();
    expect(screen.getByText('auf')).toBeInTheDocument();
  });

  it('announces correctness politely for screen readers', async () => {
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: true, acceptedText: 'auf', attemptNo: 1,
      blanksCorrect: 1, blanksTotal: 1, assignmentCompleted: true,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('на'), 'auf{Enter}');
    await waitFor(() => expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite'));
  });

  it('shows the hint, which carries new-word translations', () => {
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);
    expect(screen.getByText('(warten auf – ждать)')).toBeInTheDocument();
  });
});
```

Test 5 and test 6 are the two that matter most. Completion is the server's
decision, and a network failure must never be presented to a student as a wrong
answer.

- [ ] **Step 2: Run, confirm failure. Implement**

Behaviour notes for the implementation:
- debounce input checks at 250 ms; also check on blur and on Enter
- on `correct`, replace the input with a `<span>` styled bold + green, then move
  focus to the next unsolved blank in DOM order
- input width auto-sizes from `maxLength`
- a single retry on `NetworkError` before showing "not saved — check your connection"
- progress derived from the server's `blanksCorrect`/`blanksTotal`, never counted locally
- the whole component works with keyboard only; every blank has an associated
  `<label>` with the item number and blank position

- [ ] **Step 3: Run, confirm PASS (9 passed). Commit**

---

### Task E.4: Practice list and self-drill browser

**Files:**
- Create: `frontend/app/learner/practice/page.tsx`
- Create: `frontend/app/learner/practice/[uuid]/page.tsx`
- Create: `frontend/lib/drills/runner/SelfDrillBrowser.tsx`
- Test: `frontend/lib/drills/runner/SelfDrillBrowser.test.tsx`

- [ ] **Step 1: Write the failing test — the lock is the point**

```tsx
describe('SelfDrillBrowser', () => {
  it('shows a lock message and no set list while an assignment is outstanding', () => {
    render(<SelfDrillBrowser allowed={false} blockingTitle="Prepositions" sets={[]} />);
    expect(screen.getByText(/finish.*Prepositions/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('lists approved sets when nothing is outstanding', () => {
    render(<SelfDrillBrowser allowed={true} blockingTitle={null}
      sets={[{ uuid: 's-1', title: 'Past tense', itemCount: 20 }] as any} />);
    expect(screen.getByText('Past tense')).toBeInTheDocument();
  });

  it('surfaces a server 409 if it happens anyway, without breaking the page', async () => {
    vi.spyOn(api, 'startSelfDrill').mockRejectedValue({ code: 'ASSIGNMENT_OUTSTANDING' });
    render(<SelfDrillBrowser allowed={true} blockingTitle={null}
      sets={[{ uuid: 's-1', title: 'Past tense', itemCount: 20 }] as any} />);
    await userEvent.click(screen.getByRole('button', { name: /start/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
```

Test 3 exists because the client's `allowed` flag can go stale — the server is
the authority and the UI must degrade gracefully when they disagree.

- [ ] **Step 2: Implement the pages and component. Run, confirm PASS**

`page.tsx` for `/learner/practice` renders assigned work first, then
`<SelfDrillBrowser allowed={...}>` driven by the server's `selfDrillingAllowed`.
Both pages are client components using the API client; no answers are ever
requested or held in state.

- [ ] **Step 3: Typecheck, full suite, commit**

```bash
cd /home/ssf/Documents/Github/speakasap/frontend
rtk npm test && rtk npm run typecheck
rtk git add app/learner lib/drills/runner
rtk git commit -m "feat(frontend): student drill runner and self-drill browser

Correct answers become part of the sentence inline; completion is the
server's decision; a network failure says 'not saved' rather than
marking the student wrong.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track E completion checklist

- [ ] `rtk npm test` green in frontend, `rtk npm run typecheck` clean
- [ ] Vitest runner verified with a deliberately failing test
- [ ] Completion-is-server-decided and network-failure tests both passing
- [ ] Manual browser check of one real assignment recorded in the status file
- [ ] Status file at `status/track-e.md`
