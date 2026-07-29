# Track G — Notifications (Wave 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Tell the student there is work, and tell the teacher when it is done — without ever quoting a score.

**Service:** `speakasap/notification-service` (+ a dispatch hook in education-service) · **Depends on:** Track B2

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contract C6), spec §14.

**You own:** `notification-service/src/templates/drills/**`, and **only** `education-service/src/drills/notifications.hook.ts` in the other service. Coordinate with Track B2 before touching anything else under `education-service/src/drills/`.

---

### Task G.1: Templates

**Files:**
- Create: `notification-service/src/templates/drills/assignment-assigned.template.ts`
- Create: `notification-service/src/templates/drills/assignment-completed.template.ts`
- Test: `notification-service/src/templates/drills/templates.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  renderAssignmentAssigned(input: {
    materialLanguage: string; studentName: string; title: string;
    topics: { topic: string; url: string }[]; dueAt: string | null;
    runnerUrl: string; itemCount: number;
  }): { subject: string; html: string; text: string }

  renderAssignmentCompleted(input: {
    materialLanguage: string; teacherName: string; studentName: string;
    title: string; topics: { topic: string; url: string }[];
    lessonUrl: string | null; reviewUrl: string;
    struggledWith: { sentence: string; blankPrompt: string }[];
  }): { subject: string; html: string; text: string }
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { renderAssignmentAssigned } from './assignment-assigned.template';
import { renderAssignmentCompleted } from './assignment-completed.template';

describe('renderAssignmentAssigned', () => {
  const input = {
    materialLanguage: 'ru', studentName: 'Анна', title: 'Предлоги',
    topics: [{ topic: 'Предлоги', url: 'https://speakasap.com/de/grammar/prepositions' }],
    dueAt: '2026-08-05T00:00:00.000Z', itemCount: 50,
    runnerUrl: 'https://speakasap.alfares.cz/learner/practice/a-1',
  };

  it('renders the subject in the material language', () => {
    expect(renderAssignmentAssigned(input).subject).toMatch(/[а-яА-Я]/);
  });

  it('falls back to English for an unsupported material language', () => {
    const r = renderAssignmentAssigned({ ...input, materialLanguage: 'xx' });
    expect(r.subject).toMatch(/^[\x00-\x7F]+$/);
  });

  it('links each topic to its public grammar page', () => {
    expect(renderAssignmentAssigned(input).html)
      .toContain('https://speakasap.com/de/grammar/prepositions');
  });

  it('links to the runner', () => {
    expect(renderAssignmentAssigned(input).html)
      .toContain('https://speakasap.alfares.cz/learner/practice/a-1');
  });

  it('omits the due date section entirely when there is none', () => {
    const r = renderAssignmentAssigned({ ...input, dueAt: null });
    expect(r.text).not.toMatch(/null|undefined|Invalid Date/);
  });

  it('always emits a plain-text alternative', () => {
    expect(renderAssignmentAssigned(input).text.length).toBeGreaterThan(0);
  });

  it('escapes HTML in the student name', () => {
    const r = renderAssignmentAssigned({ ...input, studentName: '<script>x</script>' });
    expect(r.html).not.toContain('<script>');
  });
});

describe('renderAssignmentCompleted', () => {
  const input = {
    materialLanguage: 'ru', teacherName: 'Ivan', studentName: 'Анна', title: 'Предлоги',
    topics: [{ topic: 'Предлоги', url: 'https://x' }],
    lessonUrl: 'https://speakasap.alfares.cz/teacher/lessons/l-1',
    reviewUrl: 'https://speakasap.alfares.cz/teacher/assignments/a-1/review',
    struggledWith: [{ sentence: 'Ich warte ___ den Bus.', blankPrompt: 'на' }],
  };

  it('NEVER contains a percentage, an accuracy figure or a score word', () => {
    const r = renderAssignmentCompleted(input);
    const all = `${r.subject} ${r.html} ${r.text}`;
    expect(all).not.toMatch(/%/);
    expect(all).not.toMatch(/accuracy|точность|score|балл/i);
  });

  it('lists what the student struggled with, which is qualitative not numeric', () => {
    expect(renderAssignmentCompleted(input).html).toContain('Ich warte ___ den Bus.');
  });

  it('never shows a correct answer for a struggled item', () => {
    expect(renderAssignmentCompleted(input).html).not.toContain('auf');
  });

  it('links to the lesson and the review page', () => {
    const r = renderAssignmentCompleted(input);
    expect(r.html).toContain(input.lessonUrl);
    expect(r.html).toContain(input.reviewUrl);
  });

  it('omits the lesson link when the assignment is standalone', () => {
    const r = renderAssignmentCompleted({ ...input, lessonUrl: null });
    expect(r.html).not.toMatch(/null|undefined/);
  });
});
```

The first test of the second block is this track's reason to exist as a separate
review gate. "Anna finished — 62%" is exactly the email the requirements
excluded, and it is the natural thing to write.

- [ ] **Step 2: Run, confirm failure. Implement**

Copy strings for `ru` and `en`, selected by `materialLanguage` with `en` as
fallback. Escape all interpolated user data. `struggledWith` shows the sentence
with the blank rendered as `___` and the *prompt*, never the answer.

- [ ] **Step 3: Run, confirm PASS (12 passed). Commit**

---

### Task G.2: Dispatch hook in education-service

**Files:**
- Create: `education-service/src/drills/notifications.hook.ts`
- Test: `education-service/src/drills/notifications.hook.spec.ts`

**Interfaces:**
- Produces: `NotificationsHook.onAssigned(assignmentUuid)`, `NotificationsHook.onCompleted(assignmentUuid)`

- [ ] **Step 1: Write the failing test**

```ts
describe('NotificationsHook', () => {
  it('dispatches to the student on assign', async () => {
    await hook.onAssigned('a-1');
    expect(client.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      template: 'drill_assignment_assigned', recipientId: 42,
    }));
  });

  it('dispatches to the teacher on completion', async () => {
    await hook.onCompleted('a-1');
    expect(client.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      template: 'drill_assignment_completed', recipientId: 7,
    }));
  });

  it('sends NOTHING to the teacher for a self-selected drill', async () => {
    assignment.origin = 'SELF';
    assignment.teacherId = null;
    await hook.onCompleted('a-1');
    expect(client.dispatch).not.toHaveBeenCalled();
  });

  it('creates an in-app record alongside the email', async () => {
    await hook.onAssigned('a-1');
    expect(client.createInApp).toHaveBeenCalledTimes(1);
  });

  it('never throws when dispatch fails — a failed email must not block a transition', async () => {
    client.dispatch.mockRejectedValue(new Error('smtp down'));
    await expect(hook.onCompleted('a-1')).resolves.toBeUndefined();
  });

  it('logs the assignment uuid when dispatch fails', async () => {
    client.dispatch.mockRejectedValue(new Error('smtp down'));
    const warn = jest.spyOn(Logger.prototype, 'warn');
    await hook.onCompleted('a-1');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('a-1'));
  });

  it('does not resend on a repeated completion event', async () => {
    await hook.onCompleted('a-1');
    await hook.onCompleted('a-1');
    expect(client.dispatch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, confirm failure. Implement**

Fire-and-forget with a caught rejection. Idempotence via a
`notifiedAt` timestamp on the assignment row — add the column in this task's own
migration; it is a drill-owned column so it does not collide with Track B.

- [ ] **Step 3: Run, confirm PASS (7 passed). Typecheck. Commit**

```bash
cd /home/ssf/Documents/Github/speakasap
rtk npm --prefix notification-service test && rtk npm --prefix notification-service run typecheck
rtk npm --prefix education-service test -- notifications && rtk npm --prefix education-service run typecheck
rtk git add notification-service/src/templates/drills education-service/src/drills/notifications.hook.ts \
  education-service/src/drills/notifications.hook.spec.ts education-service/prisma
rtk git commit -m "feat(notifications): drill assign and completion emails

The completion email carries what the student struggled with, never a
score. A test asserts no percentage or accuracy wording can appear.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track G completion checklist

- [ ] Both suites green, both typechecks clean
- [ ] The no-score assertion passes
- [ ] Self-drill completion sends nothing to a teacher — tested
- [ ] A failing dispatch neither throws nor blocks — tested
- [ ] Status file at `status/track-g.md`
