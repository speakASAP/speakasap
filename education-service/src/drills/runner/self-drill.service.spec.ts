import { ConflictException } from '@nestjs/common';
import { SelfDrillService } from './self-drill.service';

const approvedSet = () => ({
  uuid: 's-1',
  title: 'Akkusativ drilling',
  reviewState: 'APPROVED',
  languageCode: 'de',
  materialLanguage: 'ru',
  courseKey: 'seven:german:ru',
  lessonOrder: 3,
  items: [
    {
      id: 11,
      order: 0,
      template: 'Ich warte [на]{auf} den Bus.',
      blanks: [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }],
      hint: null,
      topicSlug: 'akkusativ',
    },
  ],
});

function harness() {
  const studentProgress = { courseKey: 'seven:german:ru', lessonOrder: 5 };

  const repo: any = { findOutstanding: jest.fn(), countBlanks: jest.fn(async () => ({ blanksCorrect: 0, blanksTotal: 1 })) };
  const content: any = { getSet: jest.fn(), incrementSelfSelected: jest.fn(async () => undefined) };
  const progress: any = { getStudentProgress: jest.fn(async () => studentProgress) };

  const created: any[] = [];
  const prisma: any = {
    drillAssignment: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          ...data,
          items: (data.items?.create ?? []).map((i: any) => ({ uuid: i.uuid })),
          createdAt: new Date(),
          assignedAt: new Date(),
          completedAt: null,
          dueAt: null,
          generationProgress: null,
          resourceLinks: [],
        };
        created.push(row);
        return row;
      }),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  const svc = new SelfDrillService(prisma, repo, content, progress);
  return { svc, prisma, repo, content, progress, studentProgress, created };
}

describe('SelfDrillService.startSelfDrill', () => {
  let h: ReturnType<typeof harness>;
  let svc: SelfDrillService;
  let prisma: any;
  let repo: any;
  let content: any;
  let studentProgress: any;

  beforeEach(() => {
    h = harness();
    ({ svc, prisma, repo, content, studentProgress } = h as any);
  });

  it('refuses with 409 and names the blocking assignment when work is ASSIGNED', async () => {
    repo.findOutstanding.mockResolvedValue({ uuid: 'blocking-1', status: 'ASSIGNED' });
    await expect(svc.startSelfDrill(42, 's-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ASSIGNMENT_OUTSTANDING',
        blockingAssignmentUuid: 'blocking-1',
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
      expect.objectContaining({
        data: expect.objectContaining({ teacherId: null, origin: 'SELF', status: 'ASSIGNED' }),
      }),
    );
  });

  // A student practising from inside a lesson's homework should see that work in the
  // lesson, alongside what their teacher assigned. The row therefore carries the lesson
  // it was started from. Starting from the drills menu instead has no lesson, so the
  // column stays nullable.
  it('records the lesson a self-drill was started from', async () => {
    repo.findOutstanding.mockResolvedValue(null);
    content.getSet.mockResolvedValue(approvedSet());
    await svc.startSelfDrill(42, 's-1', 'lesson-7');
    expect(prisma.drillAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lessonUuid: 'lesson-7', origin: 'SELF', teacherId: null }),
      }),
    );
  });

  it('leaves the lesson null when started from the menu rather than a lesson', async () => {
    repo.findOutstanding.mockResolvedValue(null);
    content.getSet.mockResolvedValue(approvedSet());
    await svc.startSelfDrill(42, 's-1');
    expect(prisma.drillAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lessonUuid: null }) }),
    );
  });

  // A lesson does not buy the student past the gates.
  it('still refuses an outstanding assignment even when a lesson is named', async () => {
    repo.findOutstanding.mockResolvedValue({ uuid: 'blocking-1' });
    await expect(svc.startSelfDrill(42, 's-1', 'lesson-7')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ASSIGNMENT_OUTSTANDING' }),
    });
    expect(prisma.drillAssignment.create).not.toHaveBeenCalled();
  });

  it('increments timesSelfSelected on the set', async () => {
    repo.findOutstanding.mockResolvedValue(null);
    content.getSet.mockResolvedValue(approvedSet());
    await svc.startSelfDrill(42, 's-1');
    expect(content.incrementSelfSelected).toHaveBeenCalledWith('s-1');
  });

  // Plan Step 3: the gate is server-side enforcement, not a hidden button. This
  // calls the service directly, consulting no UI state at all.
  it('enforces the gate with no UI involvement whatsoever', async () => {
    repo.findOutstanding.mockResolvedValue({ uuid: 'blocking-3', status: 'ASSIGNED' });
    content.getSet.mockResolvedValue(approvedSet());
    await expect(svc.startSelfDrill(42, 's-1')).rejects.toThrow(ConflictException);
    // And it refuses BEFORE doing any work that would create the assignment.
    expect(prisma.drillAssignment.create).not.toHaveBeenCalled();
  });
});
