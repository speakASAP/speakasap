import {
  DrillIdentityResolverAdapter,
  GenerationJobRepositoryAdapter,
  StudentProgressClientAdapter,
} from './adapters';

describe('DrillIdentityResolverAdapter', () => {
  const fetchMock = jest.fn();
  let adapter: DrillIdentityResolverAdapter;

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock as any;
    process.env.AUTH_SERVICE_URL = 'http://auth-microservice:3370';
    process.env.INTERNAL_API_TOKEN = 'gateway-convention-secret';
    process.env.INTERNAL_SERVICE_TOKEN = 'auth-convention-secret';
    adapter = new DrillIdentityResolverAdapter();
  });

  it('resolves an auth uuid to the legacy student id', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ legacyUserId: 310740 }) });

    await expect(adapter.resolveStudentId('auth-1')).resolves.toBe(310740);

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/internal/users/by-auth-user');
    expect(url.searchParams.get('system')).toBe('speakasap-portal');
    expect(url.searchParams.get('authUserId')).toBe('auth-1');
  });

  /**
   * auth-microservice's InternalServiceGuard reads `x-internal-service-token` against
   * INTERNAL_SERVICE_TOKEN, and `x-service-name` against TRUSTED_INTERNAL_SERVICES.
   *
   * NOT `x-internal-token`/INTERNAL_API_TOKEN — that is the api-gateway's convention,
   * which orchestration/http.ts correctly sends to content-service. This adapter sent
   * the gateway's convention to auth, so every call 401'd and the teacher wizard showed
   * "Request failed with status 503" with an empty student list. The previous version of
   * this test asserted the wrong header, so it passed while production was broken.
   */
  it('sends the internal service token auth requires, not the gateway one', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ legacyUserId: 1 }) });

    await adapter.resolveStudentId('auth-1');

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['x-internal-service-token']).toBe('auth-convention-secret');
    expect(headers['x-internal-token']).toBeUndefined();
  });

  it('identifies itself with the allowlisted caller name, not the deployment name', async () => {
    // TRUSTED_INTERNAL_SERVICES is keyed on `education-service`; SERVICE_NAME is
    // `speakasap-education`, the Kubernetes deployment. Sending the latter yields
    // "Service is not trusted", indistinguishable from a bad token in the response.
    process.env.SERVICE_NAME = 'speakasap-education';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ legacyUserId: 1 }) });

    await adapter.resolveStudentId('auth-1');

    expect(fetchMock.mock.calls[0][1].headers['x-service-name']).toBe('education-service');
  });

  // Contract C7: IDENTITY_UNRESOLVED, fail closed. Every alternative here — defaulting,
  // falling back to 0, returning the first row — hands one student another student's
  // assignments and the answers inside them.
  it('fails closed with IDENTITY_UNRESOLVED when no mapping exists', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' });

    await expect(adapter.resolveStudentId('auth-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDENTITY_UNRESOLVED' }),
    });
  });

  it('fails closed when auth-microservice is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(adapter.resolveStudentId('auth-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDENTITY_UNRESOLVED' }),
    });
  });

  // An ambiguous mapping is a data defect, not a missing one. It must not be reported
  // as a plain not-found, or the duplicate legacy accounts behind it never get fixed.
  it('fails closed and says so when the mapping is ambiguous', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, text: async () => 'Ambiguous' });

    await expect(adapter.resolveStudentId('auth-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDENTITY_UNRESOLVED' }),
    });
  });

  it('rejects a non-numeric legacy id rather than coercing it', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ legacyUserId: null }) });

    await expect(adapter.resolveStudentId('auth-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDENTITY_UNRESOLVED' }),
    });
  });

  it('rejects a zero legacy id', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ legacyUserId: 0 }) });

    await expect(adapter.resolveStudentId('auth-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDENTITY_UNRESOLVED' }),
    });
  });
});

describe('StudentProgressClientAdapter', () => {
  const course = { uuid: 'sc-1', courseClass: 'de-a1' };

  const makePrisma = (over: any = {}) => ({
    studentCourse: { findFirst: jest.fn().mockResolvedValue(course) },
    lesson: { findFirst: jest.fn().mockResolvedValue({ order: 4 }) },
    ...over,
  });

  it('returns the course key and the furthest finished lesson', async () => {
    const prisma = makePrisma();

    const result = await new StudentProgressClientAdapter(prisma as any).getStudentProgress(42);

    expect(result).toEqual({ courseKey: 'de-a1', lessonOrder: 4 });
  });

  // StudentCourse carries no studentId — the student reaches a course through
  // GroupStudent -> Group -> StudentCourse. A query that forgot that would return
  // some other student's course.
  it('joins through the group to reach the student', async () => {
    const prisma = makePrisma();

    await new StudentProgressClientAdapter(prisma as any).getStudentProgress(42);

    const where = prisma.studentCourse.findFirst.mock.calls[0][0].where;
    expect(where.group.groupStudents.some.studentId).toBe(42);
    expect(where.isFinished).toBe(false);
  });

  // A student with no active course has no ceiling. Guessing one high enough to be
  // useful would show them material from lessons they have not reached.
  it('returns nulls rather than a guess when the student has no active course', async () => {
    const prisma = makePrisma({ studentCourse: { findFirst: jest.fn().mockResolvedValue(null) } });

    const result = await new StudentProgressClientAdapter(prisma as any).getStudentProgress(42);

    expect(result).toEqual({ courseKey: null, lessonOrder: null });
  });

  it('returns a null lesson ceiling when no lesson is finished yet', async () => {
    const prisma = makePrisma({ lesson: { findFirst: jest.fn().mockResolvedValue(null) } });

    const result = await new StudentProgressClientAdapter(prisma as any).getStudentProgress(42);

    expect(result).toEqual({ courseKey: 'de-a1', lessonOrder: null });
  });

  it('counts only finished lessons toward the ceiling', async () => {
    const prisma = makePrisma();

    await new StudentProgressClientAdapter(prisma as any).getStudentProgress(42);

    expect(prisma.lesson.findFirst.mock.calls[0][0].where.isFinished).toBe(true);
  });
});

/**
 * A generation that finished successfully left the assignment in GENERATING forever:
 * `updateProgress` wrote the progress blob and never touched `status`, and `cancel` was
 * the only method that did. The teacher saw "Ready, 10 of 10" on a row still marked as
 * generating, and it never reached their review queue, which counts PENDING_REVIEW.
 */
describe('GenerationJobRepositoryAdapter status transitions', () => {
  function harness() {
    const update: jest.Mock = jest.fn(async () => ({}));
    const prisma: any = { drillAssignment: { update } };
    return { adapter: new GenerationJobRepositoryAdapter(prisma), update };
  }

  const progress = (phase: string, generated = 10, total = 10) => ({
    phase, generated, total, etaSeconds: null, message: 'x', stalled: false,
  }) as any;

  it('moves the assignment to PENDING_REVIEW when the run reaches READY', async () => {
    const h = harness();

    await h.adapter.updateProgress('a-1', progress('READY'));

    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING_REVIEW' }),
      }),
    );
  });

  it('leaves the status alone while the run is still in flight', async () => {
    const h = harness();

    await h.adapter.updateProgress('a-1', progress('VALIDATING', 4));

    const data = (h.update.mock.calls[0] as any[])[0].data;
    expect(data.status).toBeUndefined();
    expect(data.generationProgress).toBeDefined();
  });

  it('does not mark a FAILED run as ready for review', async () => {
    const h = harness();

    await h.adapter.updateProgress('a-1', progress('FAILED', 0, 10));

    expect((h.update.mock.calls[0] as any[])[0].data.status).toBeUndefined();
  });
});
