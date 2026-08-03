import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DrillRunnerError,
  NetworkError,
  checkBlank,
  fetchRunner,
  listMyAssignments,
  startSelfDrill,
} from './api';

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  };
}

const checkResponse = {
  correct: true,
  acceptedText: 'auf',
  attemptNo: 1,
  blanksCorrect: 1,
  blanksTotal: 1,
  assignmentCompleted: false,
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('checkBlank', () => {
  it('posts to the gateway path with the session token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(checkResponse));
    vi.stubGlobal('fetch', fetchMock);

    await checkBlank('a-1', { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v1/drill-assignments/a-1/check');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('sends the answer as the JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(checkResponse));
    vi.stubGlobal('fetch', fetchMock);

    await checkBlank('a-1', { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      itemUuid: 'i-1',
      blankIndex: 0,
      value: 'auf',
    });
  });

  it('escapes the assignment uuid into the path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(checkResponse));
    vi.stubGlobal('fetch', fetchMock);

    await checkBlank('a/1', { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v1/drill-assignments/a%2F1/check');
  });

  it('returns the parsed body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(checkResponse)));

    await expect(checkBlank('a-1', { itemUuid: 'i-1', blankIndex: 0, value: 'auf' })).resolves.toEqual(
      checkResponse,
    );
  });

  it('throws a typed NetworkError on a transport failure so the UI can say "not saved"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(checkBlank('a-1', { itemUuid: 'i', blankIndex: 0, value: 'x' })).rejects.toMatchObject({
      name: 'NetworkError',
    });
  });

  it('throws DrillRunnerError, not NetworkError, on an HTTP error so the UI does not offer a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ statusCode: 403, code: 'SET_NOT_APPROVED', message: 'nope' }, { ok: false, status: 403 }),
      ),
    );

    const error = await checkBlank('a-1', { itemUuid: 'i', blankIndex: 0, value: 'x' }).catch((e) => e);

    expect(error).toBeInstanceOf(DrillRunnerError);
    expect(error).not.toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ status: 403, code: 'SET_NOT_APPROVED' });
  });

  it('still rejects when an error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json');
        },
      }),
    );

    const error = await checkBlank('a-1', { itemUuid: 'i', blankIndex: 0, value: 'x' }).catch((e) => e);

    expect(error).toBeInstanceOf(DrillRunnerError);
    expect(error).toMatchObject({ status: 502, code: null });
  });
});

describe('fetchRunner', () => {
  it('gets the answer-free runner payload for the assignment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ assignment: { uuid: 'a-1' }, items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchRunner('a-1');

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v1/drill-assignments/a-1/runner');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });
});

describe('listMyAssignments', () => {
  it('gets the student list route', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ outstanding: [], completedRecent: [], selfDrillingAllowed: true }));
    vi.stubGlobal('fetch', fetchMock);

    await listMyAssignments();

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v1/drill-assignments');
  });
});

describe('startSelfDrill', () => {
  it('posts the set uuid to the self-drill route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ uuid: 'a-9' }));
    vi.stubGlobal('fetch', fetchMock);

    await startSelfDrill('s-1');

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v1/drill-assignments/self');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ setUuid: 's-1' });
  });

  it('surfaces the 409 code and blocking assignment rather than a generic error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            statusCode: 409,
            code: 'ASSIGNMENT_OUTSTANDING',
            message: 'finish your assignment',
            blockingAssignmentUuid: 'b-1',
          },
          { ok: false, status: 409 },
        ),
      ),
    );

    await expect(startSelfDrill('s-1')).rejects.toMatchObject({
      code: 'ASSIGNMENT_OUTSTANDING',
      blockingAssignmentUuid: 'b-1',
    });
  });
});
