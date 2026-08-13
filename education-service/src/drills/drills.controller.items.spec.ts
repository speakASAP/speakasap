import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { DrillsController } from './drills.controller';

/**
 * The sentence editing routes: staff gating, ownership, and the argument plumbing
 * between the two edit targets (a set awaiting review vs. a live assignment).
 */

const student = (id: string) => ({
  id,
  email: null,
  firstName: null,
  lastName: null,
  phone: null,
  userType: 'student',
});
const staff = () => ({
  id: 't-1',
  email: null,
  firstName: null,
  lastName: null,
  phone: null,
  userType: 'staff',
});

const withToken = (user: any) =>
  ({ authUser: user, headers: { authorization: 'Bearer tok-123' } }) as any;

function harness() {
  const identity: any = { resolveStudentId: jest.fn(async () => 42) };
  const teacherAssignments: any = {
    lessonUuidFor: jest.fn(async () => null),
    assignmentUuidForItem: jest.fn(async () => 'a-1'),
    updateAssignmentItem: jest.fn(async () => undefined),
    deleteAssignmentItem: jest.fn(async () => undefined),
    addAssignmentItem: jest.fn(async () => undefined),
  };
  const roster: any = {
    listForLesson: jest.fn(async () => ({ students: [], groups: [], total: 0, hasMore: false, teacherId: 182 })),
  };
  const sets: any = {
    updateSetItem: jest.fn(async () => ({ uuid: 's-1', items: [] })),
    deleteSetItem: jest.fn(async () => ({ uuid: 's-1', items: [] })),
    addSetItem: jest.fn(async () => ({ uuid: 's-1', items: [] })),
  };

  const controller = new DrillsController(
    {} as any,
    {} as any,
    {} as any,
    identity,
    teacherAssignments,
    roster,
    sets,
    {} as any,
    {} as any,
    {} as any,
  );

  return { controller, identity, teacherAssignments, roster, sets };
}

const GOOD = 'Ich warte [на]{auf} den Zug.';

describe('DrillsController — set sentence routes', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it('forwards a patch with the caller bearer token', async () => {
    await h.controller.updateSetItem('s-1', '10', { template: GOOD }, withToken(staff()));
    expect(h.sets.updateSetItem).toHaveBeenCalledWith('s-1', 10, { template: GOOD }, 'tok-123');
  });

  it('refuses a student', async () => {
    // content-service has no auth guard of its own, so this check is the only thing
    // between a student and the answer bank.
    await expect(
      h.controller.updateSetItem('s-1', '10', { template: GOOD }, withToken(student('s-9'))),
    ).rejects.toThrow(ForbiddenException);
    expect(h.sets.updateSetItem).not.toHaveBeenCalled();
  });

  it('refuses a student on delete and add too', async () => {
    await expect(
      h.controller.deleteSetItem('s-1', '10', withToken(student('s-9'))),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      h.controller.addSetItem('s-1', { template: GOOD }, withToken(student('s-9'))),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a non-numeric item id rather than passing NaN upstream', async () => {
    await expect(
      h.controller.updateSetItem('s-1', 'abc', { template: GOOD }, withToken(staff())),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an add with no template', async () => {
    await expect(h.controller.addSetItem('s-1', {}, withToken(staff()))).rejects.toThrow(
      BadRequestException,
    );
    expect(h.sets.addSetItem).not.toHaveBeenCalled();
  });
});

describe('DrillsController — assignment sentence routes', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it('passes the caller id as the owner when the assignment has no lesson', async () => {
    await h.controller.updateAssignmentItem('i-1', { template: GOOD }, withToken(staff()));
    expect(h.teacherAssignments.updateAssignmentItem).toHaveBeenCalledWith(
      'i-1',
      { template: GOOD },
      [42],
    );
  });

  it('also accepts the lesson teacher as an owner', async () => {
    // Assignments created from a lesson are attributed to the Teacher profile pk, not
    // the caller's legacy user id — the same two id spaces progressForTeacher bridges.
    h.teacherAssignments.lessonUuidFor.mockResolvedValue('l-1');
    await h.controller.updateAssignmentItem('i-1', { template: GOOD }, withToken(staff()));
    expect(h.teacherAssignments.updateAssignmentItem).toHaveBeenCalledWith(
      'i-1',
      { template: GOOD },
      [42, 182],
    );
  });

  it('404s when the sentence does not exist', async () => {
    h.teacherAssignments.assignmentUuidForItem.mockResolvedValue(null);
    await expect(
      h.controller.updateAssignmentItem('nope', { template: GOOD }, withToken(staff())),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an empty patch instead of reporting a save that changed nothing', async () => {
    await expect(
      h.controller.updateAssignmentItem('i-1', {}, withToken(staff())),
    ).rejects.toThrow(BadRequestException);
    expect(h.teacherAssignments.updateAssignmentItem).not.toHaveBeenCalled();
  });

  it('refuses a student', async () => {
    await expect(
      h.controller.updateAssignmentItem('i-1', { template: GOOD }, withToken(student('s-9'))),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      h.controller.deleteAssignmentItem('i-1', withToken(student('s-9'))),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      h.controller.addAssignmentItem('a-1', { template: GOOD }, withToken(student('s-9'))),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects an add with no template', async () => {
    await expect(h.controller.addAssignmentItem('a-1', {}, withToken(staff()))).rejects.toThrow(
      BadRequestException,
    );
    expect(h.teacherAssignments.addAssignmentItem).not.toHaveBeenCalled();
  });
});

describe('route registration order', () => {
  /**
   * `teacher/:uuid/items` and `teacher/sets/:setUuid/items` both match
   * `POST teacher/sets/items`-shaped paths. Nest resolves by declaration order, so the
   * specific route must be declared before the wildcard one or every set-item add would
   * be routed to the assignment handler with `uuid = "sets"`.
   *
   * Asserted against the real metadata rather than trusting line order to survive edits.
   */
  const pathsFor = (method: RequestMethod): string[] => {
    const proto = DrillsController.prototype as any;
    return Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor' && typeof proto[name] === 'function')
      .filter((name) => Reflect.getMetadata(METHOD_METADATA, proto[name]) === method)
      .map((name) => Reflect.getMetadata(PATH_METADATA, proto[name]) as string);
  };

  it('declares the set-item route before the assignment-item route', () => {
    const posts = pathsFor(RequestMethod.POST);
    const setItems = posts.indexOf('teacher/sets/:setUuid/items');
    const assignmentItems = posts.indexOf('teacher/:uuid/items');

    expect(setItems).toBeGreaterThanOrEqual(0);
    expect(assignmentItems).toBeGreaterThanOrEqual(0);
    expect(setItems).toBeLessThan(assignmentItems);
  });
});
