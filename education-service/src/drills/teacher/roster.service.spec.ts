import { TeacherRosterService } from './roster.service';
import {
  LessonNotFoundError,
  LessonServiceUnavailableError,
} from '../../lesson-client/lesson-client.types';

function harness(names: Map<number, string> = new Map()) {
  const prisma: any = {
    lesson: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
    studentCourse: { findMany: jest.fn(async () => []) },
    group: { findMany: jest.fn(async () => []) },
  };
  const auth: any = { resolveLegacyNames: jest.fn(async () => names) };
  // Defaults to raising: an unstubbed lesson lookup must never silently succeed with
  // an empty roster, which is the exact bug this whole change removes.
  const lessons: any = {
    getRoster: jest.fn(async () => {
      throw new LessonServiceUnavailableError('unstubbed', 'test did not stub getRoster');
    }),
  };
  return {
    service: new TeacherRosterService(prisma, auth, lessons),
    prisma,
    auth,
    lessons,
  };
}

describe('TeacherRosterService', () => {
  it('walks lessons to courses to groups to students', async () => {
    const h = harness();
    h.prisma.lesson.findMany.mockResolvedValue([{ studentCourseUuid: 'c-1' }]);
    h.prisma.studentCourse.findMany.mockResolvedValue([{ groupUuid: 'g-1' }]);
    h.prisma.group.findMany.mockResolvedValue([
      { uuid: 'g-1', title: 'Tuesday A2', groupStudents: [{ studentId: 7 }, { studentId: 8 }] },
    ]);

    const roster = await h.service.listForTeacher(99);

    expect(h.prisma.lesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teacherId: 99 } }),
    );
    expect(roster.students.map((s) => s.id)).toEqual([7, 8]);
    expect(roster.groups).toEqual([
      { uuid: 'g-1', name: 'Tuesday A2', studentIds: [7, 8] },
    ]);
  });

  // A student in two of the teacher's groups is one person. Listing them twice would
  // read as two students with the same id.
  it('lists a student in two groups exactly once, carrying both group uuids', async () => {
    const h = harness();
    h.prisma.lesson.findMany.mockResolvedValue([{ studentCourseUuid: 'c-1' }]);
    h.prisma.studentCourse.findMany.mockResolvedValue([{ groupUuid: 'g-1' }, { groupUuid: 'g-2' }]);
    h.prisma.group.findMany.mockResolvedValue([
      { uuid: 'g-1', title: 'A', groupStudents: [{ studentId: 7 }] },
      { uuid: 'g-2', title: 'B', groupStudents: [{ studentId: 7 }, { studentId: 8 }] },
    ]);

    const roster = await h.service.listForTeacher(99);

    expect(roster.students).toHaveLength(2);
    expect(roster.students.find((s) => s.id === 7)?.groupUuids).toEqual(['g-1', 'g-2']);
  });

  it('returns an empty roster for a teacher with no lessons, without querying further', async () => {
    const h = harness();
    h.prisma.lesson.findMany.mockResolvedValue([]);

    await expect(h.service.listForTeacher(99)).resolves.toEqual({ students: [], groups: [], total: 0, hasMore: false });
    expect(h.prisma.studentCourse.findMany).not.toHaveBeenCalled();
    expect(h.prisma.group.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty roster when the lessons map to no groups', async () => {
    const h = harness();
    h.prisma.lesson.findMany.mockResolvedValue([{ studentCourseUuid: 'c-1' }]);
    h.prisma.studentCourse.findMany.mockResolvedValue([]);

    await expect(h.service.listForTeacher(99)).resolves.toEqual({ students: [], groups: [], total: 0, hasMore: false });
    expect(h.prisma.group.findMany).not.toHaveBeenCalled();
  });

  it('handles a group with no students', async () => {
    const h = harness();
    h.prisma.lesson.findMany.mockResolvedValue([{ studentCourseUuid: 'c-1' }]);
    h.prisma.studentCourse.findMany.mockResolvedValue([{ groupUuid: 'g-1' }]);
    h.prisma.group.findMany.mockResolvedValue([
      { uuid: 'g-1', title: 'Empty', groupStudents: [] },
    ]);

    const roster = await h.service.listForTeacher(99);
    expect(roster.students).toEqual([]);
    expect(roster.groups).toEqual([{ uuid: 'g-1', name: 'Empty', studentIds: [] }]);
  });

  // An id auth has no mapping for stays empty rather than becoming a placeholder that
  // reads like a real name. The frontend's "Student <id>" fallback covers this case.
  it('leaves the name empty when auth has no mapping for the id', async () => {
    const h = harness();
    h.prisma.lesson.findMany.mockResolvedValue([{ studentCourseUuid: 'c-1' }]);
    h.prisma.studentCourse.findMany.mockResolvedValue([{ groupUuid: 'g-1' }]);
    h.prisma.group.findMany.mockResolvedValue([
      { uuid: 'g-1', title: 'A', groupStudents: [{ studentId: 7 }] },
    ]);

    const roster = await h.service.listForTeacher(99);
    expect(roster.students[0].name).toBe('');
  });

  // The defect this fixes: every student rendered as "Student 58" in the wizard because
  // the roster returned name: '' for all 656 of teacher 10's students.
  describe('name resolution, search and paging', () => {
    function rosterOf(ids: number[], names: Map<number, string>) {
      const h = harness(names);
      h.prisma.lesson.findMany.mockResolvedValue([{ studentCourseUuid: 'c-1' }]);
      h.prisma.studentCourse.findMany.mockResolvedValue([{ groupUuid: 'g-1' }]);
      h.prisma.group.findMany.mockResolvedValue([
        { uuid: 'g-1', title: 'A', groupStudents: ids.map((id) => ({ studentId: id })) },
      ]);
      return h;
    }

    it('fills names resolved from auth', async () => {
      const h = rosterOf([7, 8], new Map([[7, 'Anna Novak'], [8, 'Boris Petrov']]));

      const roster = await h.service.listForTeacher(99);

      expect(roster.students.map((s) => s.name)).toEqual(['Anna Novak', 'Boris Petrov']);
      expect(h.auth.resolveLegacyNames).toHaveBeenCalledWith([7, 8]);
    });

    // One call for the whole roster, not one per student — 656 students would otherwise
    // be 656 round trips to build a single picker.
    it('resolves the whole roster in one batch call', async () => {
      const h = rosterOf([7, 8, 9], new Map());
      await h.service.listForTeacher(99);
      expect(h.auth.resolveLegacyNames).toHaveBeenCalledTimes(1);
    });

    it('sorts named students alphabetically, unnamed ones last by id', async () => {
      const h = rosterOf([9, 7, 8], new Map([[9, 'Anna'], [7, 'Zoe']]));

      const roster = await h.service.listForTeacher(99);

      expect(roster.students.map((s) => s.id)).toEqual([9, 7, 8]);
    });

    it('pages, reporting the pre-page total and whether more remain', async () => {
      const h = rosterOf([1, 2, 3, 4, 5], new Map());

      const first = await h.service.listForTeacher(99, { limit: 2, offset: 0 });
      expect(first.students.map((s) => s.id)).toEqual([1, 2]);
      expect(first.total).toBe(5);
      expect(first.hasMore).toBe(true);

      const last = await h.service.listForTeacher(99, { limit: 2, offset: 4 });
      expect(last.students.map((s) => s.id)).toEqual([5]);
      expect(last.hasMore).toBe(false);
    });

    it('searches on the resolved name, case-insensitively', async () => {
      const h = rosterOf([7, 8], new Map([[7, 'Anna Novak'], [8, 'Boris Petrov']]));

      const roster = await h.service.listForTeacher(99, { search: 'nOvAk' });

      expect(roster.students.map((s) => s.id)).toEqual([7]);
      expect(roster.total).toBe(1);
    });

    // Searching after paging would only ever search the current window.
    it('searches the whole roster, not just the first page', async () => {
      const h = rosterOf([1, 2, 3, 4, 5], new Map([[5, 'Zoe Last']]));

      const roster = await h.service.listForTeacher(99, { search: 'zoe', limit: 2 });

      expect(roster.students.map((s) => s.id)).toEqual([5]);
    });

    it('falls back to matching the id for a student auth cannot name', async () => {
      const h = rosterOf([58, 111], new Map());

      const roster = await h.service.listForTeacher(99, { search: '111' });

      expect(roster.students.map((s) => s.id)).toEqual([111]);
    });

    // A picker showing ids is poor; a picker that will not open is worse.
    it('degrades to ids rather than failing when auth is unreachable', async () => {
      const h = rosterOf([7, 8], new Map());
      h.auth.resolveLegacyNames.mockResolvedValue(new Map());

      const roster = await h.service.listForTeacher(99);

      expect(roster.students.map((s) => s.id)).toEqual([7, 8]);
      expect(roster.students.every((s) => s.name === '')).toBe(true);
    });

    it('caps an oversized limit rather than returning the whole roster', async () => {
      const h = rosterOf([1, 2, 3], new Map());

      const roster = await h.service.listForTeacher(99, { limit: 100000 });

      expect(roster.students).toHaveLength(3);
      expect(roster.hasMore).toBe(false);
    });
  });

  it('deduplicates the course lookup by student course', async () => {
    const h = harness();
    h.prisma.lesson.findMany.mockResolvedValue([{ studentCourseUuid: 'c-1' }]);
    h.prisma.studentCourse.findMany.mockResolvedValue([{ groupUuid: 'g-1' }]);
    h.prisma.group.findMany.mockResolvedValue([]);

    await h.service.listForTeacher(99);
    expect(h.prisma.lesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ['studentCourseUuid'] }),
    );
  });

  /**
   * Scoping by lesson, for a teacher arriving from a portal lesson page.
   *
   * `Lesson.teacherId` is the legacy **Teacher profile pk** (182), not the user id (3).
   * Education-service resolves a login to the user id and has no table mapping one to the
   * other — `employees_teacher` lives in the portal's database, not this one. Reading the
   * teacher off the lesson sidesteps that entirely: the lesson names its own teacher and
   * its own students.
   *
   * The caller is already proven staff by the JWT (`assertStaff`), so this narrows a
   * staff member to one lesson's roster rather than widening anyone's access.
   */
  describe('scoped to a lesson', () => {
    function lessonHarness() {
      const h = harness(new Map([[3, 'Сергей Партизанов']]));
      // Sourced from the portal, which owns lessons. Nothing local is consulted.
      h.lessons.getRoster.mockResolvedValue({
        lessonUuid: 'l-1',
        teacherId: 182,
        groups: [{ uuid: 'g-1', name: 'B1 individual', studentIds: [3] }],
        studentIds: [3],
        paidStudentIds: [3],
      });
      return h;
    }

    it('returns the students of that lesson without knowing the teacher id', async () => {
      const h = lessonHarness();

      const roster = await h.service.listForLesson('l-1');

      expect(roster.students.map((s) => s.id)).toEqual([3]);
      expect(roster.students[0].name).toBe('Сергей Партизанов');
    });

    it('never queries lessons by teacherId, which is the id-space bug', async () => {
      const h = lessonHarness();

      await h.service.listForLesson('l-1');

      expect(h.prisma.lesson.findMany).not.toHaveBeenCalled();
    });

    it('reports the lesson teacher so the caller can attribute the assignment', async () => {
      const h = lessonHarness();

      const roster = await h.service.listForLesson('l-1');

      expect(roster.teacherId).toBe(182);
    });

    // INVERTED 2026-08-09. This test used to assert that a nonexistent lesson yields an
    // empty roster, which encoded the defect as the contract: education-service read a
    // COPY of the lesson tables whose ETL last ran 2026-06-26, so every lesson created
    // after that date looked "nonexistent" and every teacher saw an empty student list
    // with no error anywhere. A green test kept the bug invisible for six weeks.
    it('RAISES for a lesson that does not exist, rather than emptying the roster', async () => {
      const h = lessonHarness();
      h.lessons.getRoster.mockRejectedValue(new LessonNotFoundError('missing'));

      await expect(h.service.listForLesson('missing'))
        .rejects.toBeInstanceOf(LessonNotFoundError);
    });
  });
});

describe('TeacherRosterService.listForLesson (portal-sourced)', () => {
  const LESSON = 'f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477';

  it('returns the roster the portal reports, with names resolved', async () => {
    const h = harness(new Map([[3, 'Ann'], [7, 'Bob']]));
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON,
      teacherId: 182,
      groups: [{ uuid: 'g-1', name: 'Group A', studentIds: [3, 7] }],
      studentIds: [3, 7],
      paidStudentIds: [3, 7],
    });

    const result = await h.service.listForLesson(LESSON);

    expect(result.teacherId).toBe(182);
    expect(result.total).toBe(2);
    expect(result.students.map((s) => s.name)).toEqual(['Ann', 'Bob']);
    expect(result.groups[0].name).toBe('Group A');
    expect(result.students[0].groupUuids).toEqual(['g-1']);
  });

  it('never touches the local lesson tables', async () => {
    const h = harness(new Map([[3, 'Ann']]));
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [{ uuid: 'g-1', name: 'G', studentIds: [3] }],
      studentIds: [3], paidStudentIds: [3],
    });

    await h.service.listForLesson(LESSON);

    expect(h.prisma.lesson.findFirst).not.toHaveBeenCalled();
    expect(h.prisma.studentCourse.findMany).not.toHaveBeenCalled();
    expect(h.prisma.group.findMany).not.toHaveBeenCalled();
  });

  it('PROPAGATES a missing lesson instead of returning an empty roster', async () => {
    // The regression this whole change exists to fix: a lesson the service cannot see
    // used to render as "this teacher has no students".
    const h = harness();
    h.lessons.getRoster.mockRejectedValue(new LessonNotFoundError(LESSON));

    await expect(h.service.listForLesson(LESSON))
      .rejects.toBeInstanceOf(LessonNotFoundError);
  });

  it('PROPAGATES a portal outage instead of returning an empty roster', async () => {
    const h = harness();
    h.lessons.getRoster.mockRejectedValue(
      new LessonServiceUnavailableError(LESSON, 'ECONNREFUSED'));

    await expect(h.service.listForLesson(LESSON))
      .rejects.toBeInstanceOf(LessonServiceUnavailableError);
  });

  it('reports a genuinely empty group as empty, not as an error', async () => {
    // The counterpart to the tests above: empty must still be expressible when it is
    // the truth, otherwise the fix would just invert the bug.
    const h = harness();
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182, groups: [], studentIds: [], paidStudentIds: [],
    });

    const result = await h.service.listForLesson(LESSON);

    expect(result.students).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.teacherId).toBe(182);
  });

  it('applies search and paging to the portal roster', async () => {
    const h = harness(new Map([[3, 'Ann'], [7, 'Bob'], [9, 'Anna']]));
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [{ uuid: 'g-1', name: 'G', studentIds: [3, 7, 9] }],
      studentIds: [3, 7, 9], paidStudentIds: [3, 7, 9],
    });

    const result = await h.service.listForLesson(LESSON, { search: 'ann' });

    expect(result.students.map((s) => s.name).sort()).toEqual(['Ann', 'Anna']);
    expect(result.total).toBe(2);
  });
});
