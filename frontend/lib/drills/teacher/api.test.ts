import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DrillApiError,
  approveSet,
  getTeacherSummary,
  assignFromSet,
  createAssignmentItem,
  createSetItem,
  deleteAssignmentItem,
  deleteSetItem,
  generateAssignments,
  updateAssignmentItem,
  getAssignment,
  getSet,
  listLanguages,
  listSets,
  listTeacherStudents,
  listTopics,
  rateSet,
  regenerateItems,
  updateSetItem,
} from './api';

function okFetch(payload: unknown = {}) {
  const f = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => payload,
  });
  vi.stubGlobal('fetch', f);
  return f;
}

function errorFetch(status: number, body: unknown) {
  const f = vi.fn().mockResolvedValue({
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  });
  vi.stubGlobal('fetch', f);
  return f;
}

const urlOf = (f: ReturnType<typeof vi.fn>): string => String(f.mock.calls[0][0]);
const initOf = (f: ReturnType<typeof vi.fn>): RequestInit => f.mock.calls[0][1] as RequestInit;

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('listSets', () => {
  it('serializes topicSlugs as repeated query params', async () => {
    const f = okFetch({ sets: [], total: 0 });
    await listSets({ topicSlugs: ['prepositions', 'past-tense'] });
    expect(urlOf(f)).toContain('topicSlugs=prepositions');
    expect(urlOf(f)).toContain('topicSlugs=past-tense');
  });

  it('omits empty filters rather than sending blanks', async () => {
    const f = okFetch({ sets: [], total: 0 });
    await listSets({ q: '', courseKey: undefined });
    expect(urlOf(f)).not.toContain('q=');
    expect(urlOf(f)).not.toContain('courseKey=');
  });

  it('keeps a zero lessonOrder, which is a real lesson and not an empty filter', async () => {
    const f = okFetch({ sets: [], total: 0 });
    await listSets({ lessonOrder: 0 });
    expect(urlOf(f)).toContain('lessonOrder=0');
  });

  it('sends no query string at all when the query is empty', async () => {
    const f = okFetch({ sets: [], total: 0 });
    await listSets({});
    expect(urlOf(f)).not.toContain('?');
  });

  it('returns the parsed body', async () => {
    okFetch({ sets: [{ uuid: 's-1' }], total: 1 });
    await expect(listSets({})).resolves.toMatchObject({ total: 1 });
  });
});

describe('approveSet', () => {
  it('surfaces UNRESOLVED_VALIDATION_FAILURES as a typed error', async () => {
    errorFetch(409, {
      statusCode: 409,
      code: 'UNRESOLVED_VALIDATION_FAILURES',
      message: '2 items still fail validation',
    });
    await expect(approveSet('s-1')).rejects.toMatchObject({
      code: 'UNRESOLVED_VALIDATION_FAILURES',
    });
  });

  it('throws a DrillApiError carrying the status and message', async () => {
    errorFetch(409, {
      statusCode: 409,
      code: 'UNRESOLVED_VALIDATION_FAILURES',
      message: '2 items still fail validation',
    });
    const error = await approveSet('s-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DrillApiError);
    expect(error).toMatchObject({ status: 409, message: '2 items still fail validation' });
  });

  // A gateway 502 or a proxy timeout returns HTML, not the typed error body. Parsing it
  // must not turn a failed request into a resolved promise.
  it('still throws when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        headers: new Headers({ 'content-type': 'text/html' }),
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      }),
    );
    const error = await approveSet('s-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DrillApiError);
    expect(error).toMatchObject({ status: 502, code: null });
  });
});

describe('mutations', () => {
  it('posts a generation request', async () => {
    const f = okFetch({ assignmentUuids: ['a-1'] });
    await generateAssignments({ studentIds: [7], count: 50 } as never);
    expect(urlOf(f)).toContain('/drill-assignments/generate');
    expect(initOf(f).method).toBe('POST');
    expect(JSON.parse(String(initOf(f).body))).toMatchObject({ count: 50 });
  });

  it('posts an assignment from an existing set', async () => {
    const f = okFetch({ assignments: [] });
    await assignFromSet({ setUuid: 's-1', studentIds: [7] } as never);
    expect(urlOf(f)).toContain('/drill-assignments/assign');
    expect(initOf(f).method).toBe('POST');
  });

  /*
   * Routed through education-service, not at `/drill-sets/...` directly.
   * content-service's item routes are internal-only and gated on a token no browser
   * holds, so the direct path 404'd — these assertions used to pin that broken URL and
   * passed while the feature did not work at all.
   */
  it('patches a set item through the teacher route', async () => {
    const f = okFetch({});
    await updateSetItem('s-1', 42, { hint: 'note' } as never);
    expect(urlOf(f)).toContain('/drill-assignments/teacher/sets/s-1/items/42');
    expect(initOf(f).method).toBe('PATCH');
  });

  it('deletes a set item through the teacher route', async () => {
    const f = okFetch({});
    await deleteSetItem('s-1', 42);
    expect(urlOf(f)).toContain('/drill-assignments/teacher/sets/s-1/items/42');
    expect(initOf(f).method).toBe('DELETE');
  });

  it('creates a set item through the teacher route', async () => {
    const f = okFetch({});
    await createSetItem('s-1', { template: 'Ich warte [на]{auf} den Bus.', hint: null });
    expect(urlOf(f)).toContain('/drill-assignments/teacher/sets/s-1/items');
    expect(initOf(f).method).toBe('POST');
  });

  it('patches an assignment sentence', async () => {
    const f = okFetch({ ok: true });
    await updateAssignmentItem('i-1', { template: 'Ich warte [на]{auf} den Bus.' });
    expect(urlOf(f)).toContain('/drill-assignments/teacher/items/i-1');
    expect(initOf(f).method).toBe('PATCH');
  });

  it('deletes an assignment sentence', async () => {
    const f = okFetch({ ok: true });
    await deleteAssignmentItem('i-1');
    expect(urlOf(f)).toContain('/drill-assignments/teacher/items/i-1');
    expect(initOf(f).method).toBe('DELETE');
  });

  it('adds an assignment sentence', async () => {
    const f = okFetch({ ok: true });
    await createAssignmentItem('a-1', { template: 'Ich warte [на]{auf} den Bus.', hint: null });
    expect(urlOf(f)).toContain('/drill-assignments/teacher/a-1/items');
    expect(initOf(f).method).toBe('POST');
  });

  it('batches a regeneration request', async () => {
    const f = okFetch({});
    await regenerateItems('s-1', [2, 3], 'too hard');
    expect(urlOf(f)).toContain('/drill-sets/s-1/regenerate');
    expect(JSON.parse(String(initOf(f).body))).toEqual({ itemIds: [2, 3], note: 'too hard' });
  });

  it('omits an absent regeneration note rather than sending null', async () => {
    const f = okFetch({});
    await regenerateItems('s-1', [2]);
    expect(JSON.parse(String(initOf(f).body))).toEqual({ itemIds: [2] });
  });

  it('rates a set', async () => {
    const f = okFetch({});
    await rateSet('s-1', 1);
    expect(urlOf(f)).toContain('/drill-sets/s-1/rate');
    expect(JSON.parse(String(initOf(f).body))).toEqual({ value: 1 });
  });
});

describe('reads', () => {
  it('gets one assignment', async () => {
    const f = okFetch({ uuid: 'a-1' });
    await expect(getAssignment('a-1')).resolves.toMatchObject({ uuid: 'a-1' });
    expect(urlOf(f)).toContain('/drill-assignments/a-1');
  });

  it('gets one set through education-service, not content-service directly', async () => {
    // content-service's own `drill-sets/:uuid` carries answers and sits behind the
    // gateway's internal-token prefix, which a browser cannot satisfy — calling it from
    // here 404'd the review screen. education-service checks the caller is staff and
    // makes the internal hop itself.
    const f = okFetch({ uuid: 's-1' });
    await getSet('s-1');
    expect(urlOf(f)).toContain('/drill-assignments/teacher/sets/s-1');
  });

  it('lists topics for a language pair', async () => {
    const f = okFetch([]);
    await listTopics('de', 'ru');
    expect(urlOf(f)).toContain('languageCode=de');
    expect(urlOf(f)).toContain('materialLanguage=ru');
  });

  it('lists languages', async () => {
    const f = okFetch([{ id: 3, code: 'de', name: 'Немецкий' }]);
    await expect(listLanguages()).resolves.toHaveLength(1);
    expect(urlOf(f)).toContain('/drill-languages');
  });

  it('lists the teacher roster', async () => {
    const f = okFetch({ students: [], groups: [] });
    await expect(listTeacherStudents()).resolves.toEqual({ students: [], groups: [] });
    expect(urlOf(f)).toContain('/drill-assignments/teacher/students');
  });

  /**
   * Approving redirected to /teacher/assignments, which was never built — a plain Next
   * 404 with no way back. The page needs the teacher's own summary.
   */
  it('gets the teacher summary', async () => {
    const f = okFetch({ awaitingReview: 0, assigned: 0, completedThisWeek: 0, reviewQueue: [] });
    await getTeacherSummary();
    expect(urlOf(f)).toContain('/drill-assignments/teacher/summary');
  });
});
