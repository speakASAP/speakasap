import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TeacherAssignmentsService } from './teacher-assignments.service';

/**
 * Teacher edits to a live assignment's sentences.
 *
 * Distinct from editing a set: these rows were copied onto the student's assignment at
 * approval, and the student may already have answered them. The rule those attempts
 * force is the subject of most of these tests — a changed template invalidates what was
 * graded against the old one.
 */

const ITEM = {
  uuid: 'i-1',
  assignmentUuid: 'a-1',
  order: 0,
  template: 'Ich warte [на]{auf} den Bus.',
  blanks: [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }],
  hint: null,
};

const SIBLING = { ...ITEM, uuid: 'i-2', order: 1, template: 'Ich gehe [в]{in} die Schule.' };

function harness(assignmentOverrides: Record<string, unknown> = {}) {
  const assignment = {
    uuid: 'a-1',
    status: 'IN_PROGRESS',
    teacherId: 182,
    studentId: 7,
    lessonUuid: 'l-1',
    items: [ITEM, SIBLING],
    ...assignmentOverrides,
  };

  const prisma: any = {
    drillAssignment: {
      findUnique: jest.fn(async () => assignment),
      update: jest.fn(async () => assignment),
    },
    drillAssignmentItem: {
      findUnique: jest.fn(async () => ({ ...ITEM, assignment })),
      findMany: jest.fn(async () => assignment.items),
      update: jest.fn(async () => ITEM),
      create: jest.fn(async ({ data }: any) => data),
      delete: jest.fn(async () => ITEM),
    },
    drillAttempt: {
      deleteMany: jest.fn(async () => ({ count: 3 })),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  const svc = new TeacherAssignmentsService(
    prisma,
    { countBlanks: jest.fn(async () => ({ blanksCorrect: 0, blanksTotal: 2 })) } as any,
    {} as any,
    {} as any,
    {} as any,
    // Lesson reader: item editing never reaches `generate`, the only caller of it.
    {} as any,
    {} as any,
  );

  return { svc, prisma, assignment };
}

const GOOD = 'Ich warte [на]{auf} den Zug.';

describe('TeacherAssignmentsService.updateAssignmentItem', () => {
  it('writes the template and its recomputed blanks together', async () => {
    // blanksTotal is summed from this column; a template saved without matching blanks
    // makes the assignment uncompletable and permanently blocks self-drilling.
    const { svc, prisma } = harness();
    await svc.updateAssignmentItem('i-1', { template: GOOD }, [182]);

    const data = prisma.drillAssignmentItem.update.mock.calls[0][0].data;
    expect(data.template).toBe(GOOD);
    expect(data.blanks).toEqual([{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }]);
  });

  it('deletes the attempts recorded against the edited sentence', async () => {
    // Those attempts were graded against the old blanks; keeping them would show a
    // "solved" badge for an answer the student never gave to this question.
    const { svc, prisma } = harness();
    await svc.updateAssignmentItem('i-1', { template: GOOD }, [182]);

    expect(prisma.drillAttempt.deleteMany).toHaveBeenCalledWith({ where: { itemUuid: 'i-1' } });
  });

  it('leaves other sentences\' attempts alone', async () => {
    const { svc, prisma } = harness();
    await svc.updateAssignmentItem('i-1', { template: GOOD }, [182]);

    for (const call of prisma.drillAttempt.deleteMany.mock.calls) {
      expect(call[0].where.itemUuid).toBe('i-1');
    }
  });

  it('does not reset attempts when only the hint changed', async () => {
    // The question is unchanged, so the answers to it are still answers to it.
    const { svc, prisma } = harness();
    await svc.updateAssignmentItem('i-1', { hint: 'dative' }, [182]);

    expect(prisma.drillAttempt.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a sentence with no blank and writes nothing', async () => {
    const { svc, prisma } = harness();
    await expect(
      svc.updateAssignmentItem('i-1', { template: 'Ich warte den Zug.' }, [182]),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.drillAssignmentItem.update).not.toHaveBeenCalled();
    expect(prisma.drillAttempt.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses to edit a COMPLETED assignment', async () => {
    // COMPLETED is terminal in the state machine, so an edit could not reopen the
    // assignment for the student to redo — it would silently change history.
    const { svc } = harness({ status: 'COMPLETED' });
    await expect(svc.updateAssignmentItem('i-1', { template: GOOD }, [182])).rejects.toThrow(
      ConflictException,
    );
  });

  it('refuses to edit a CANCELLED assignment', async () => {
    const { svc } = harness({ status: 'CANCELLED' });
    await expect(svc.updateAssignmentItem('i-1', { template: GOOD }, [182])).rejects.toThrow(
      ConflictException,
    );
  });

  it('404s for a teacher who does not own the assignment', async () => {
    // Same ownership rule as progressForTeacher, and the same 404 rather than a 403:
    // a teacher must not learn that another teacher's assignment exists.
    const { svc } = harness();
    await expect(svc.updateAssignmentItem('i-1', { template: GOOD }, [999])).rejects.toThrow(
      NotFoundException,
    );
  });

  it('404s when the assignment has no teacher recorded', async () => {
    const { svc } = harness({ teacherId: null });
    await expect(svc.updateAssignmentItem('i-1', { template: GOOD }, [182])).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('TeacherAssignmentsService.deleteAssignmentItem', () => {
  it('deletes the sentence and its attempts, then closes the ordering gap', async () => {
    const { svc, prisma } = harness();
    await svc.deleteAssignmentItem('i-1', [182]);

    expect(prisma.drillAssignmentItem.delete).toHaveBeenCalledWith({ where: { uuid: 'i-1' } });
    expect(prisma.drillAttempt.deleteMany).toHaveBeenCalledWith({ where: { itemUuid: 'i-1' } });
    expect(prisma.drillAssignmentItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { uuid: 'i-2' }, data: { order: 0 } }),
    );
  });

  it('refuses to delete the last remaining sentence', async () => {
    const { svc, prisma } = harness({ items: [ITEM] });
    await expect(svc.deleteAssignmentItem('i-1', [182])).rejects.toThrow(BadRequestException);
    expect(prisma.drillAssignmentItem.delete).not.toHaveBeenCalled();
  });

  it('refuses on a terminal assignment', async () => {
    const { svc } = harness({ status: 'COMPLETED' });
    await expect(svc.deleteAssignmentItem('i-1', [182])).rejects.toThrow(ConflictException);
  });
});

describe('TeacherAssignmentsService.addAssignmentItem', () => {
  it('appends after the last sentence with its blanks derived', async () => {
    const { svc, prisma } = harness();
    await svc.addAssignmentItem('a-1', { template: GOOD, hint: null }, [182]);

    const data = prisma.drillAssignmentItem.create.mock.calls[0][0].data;
    expect(data.order).toBe(2);
    expect(data.template).toBe(GOOD);
    expect(data.blanks).toHaveLength(1);
    expect(data.assignmentUuid).toBe('a-1');
  });

  it('gives the new sentence its own uuid', async () => {
    const { svc, prisma } = harness();
    await svc.addAssignmentItem('a-1', { template: GOOD, hint: null }, [182]);
    expect(prisma.drillAssignmentItem.create.mock.calls[0][0].data.uuid).toEqual(
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
  });

  it('rejects a sentence with no blank', async () => {
    const { svc, prisma } = harness();
    await expect(
      svc.addAssignmentItem('a-1', { template: 'no blank.', hint: null }, [182]),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.drillAssignmentItem.create).not.toHaveBeenCalled();
  });

  it('refuses on a terminal assignment', async () => {
    // Adding work to a finished assignment would reopen it without a legal transition.
    const { svc } = harness({ status: 'COMPLETED' });
    await expect(
      svc.addAssignmentItem('a-1', { template: GOOD, hint: null }, [182]),
    ).rejects.toThrow(ConflictException);
  });
});
