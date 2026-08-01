import { DrillIdentityResolverAdapter, StudentProgressClientAdapter } from './adapters';

describe('DrillIdentityResolverAdapter', () => {
  const fetchMock = jest.fn();
  let adapter: DrillIdentityResolverAdapter;

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock as any;
    process.env.AUTH_SERVICE_URL = 'http://auth-microservice:3370';
    process.env.INTERNAL_API_TOKEN = 'internal-secret';
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

  it('sends the internal token the auth guard requires', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ legacyUserId: 1 }) });

    await adapter.resolveStudentId('auth-1');

    expect(fetchMock.mock.calls[0][1].headers['x-internal-token']).toBe('internal-secret');
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
