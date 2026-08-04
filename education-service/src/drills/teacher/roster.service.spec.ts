import { TeacherRosterService } from './roster.service';

function harness(names: Map<number, string> = new Map()) {
  const prisma: any = {
    lesson: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
    studentCourse: { findMany: jest.fn(async () => []) },
    group: { findMany: jest.fn(async () => []) },
  };
  const auth: any = { resolveLegacyNames: jest.fn(async () => names) };
  return { service: new TeacherRosterService(prisma, auth), prisma, auth };
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
      h.prisma.lesson.findFirst.mockResolvedValue({
        uuid: 'l-1',
        teacherId: 182,
        studentCourseUuid: 'c-1',
      });
      h.prisma.studentCourse.findMany.mockResolvedValue([{ groupUuid: 'g-1' }]);
      h.prisma.group.findMany.mockResolvedValue([
        { uuid: 'g-1', title: 'B1 individual', groupStudents: [{ studentId: 3 }] },
      ]);
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

    it('returns an empty roster for a lesson that does not exist', async () => {
      const h = lessonHarness();
      h.prisma.lesson.findFirst.mockResolvedValue(null);

      const roster = await h.service.listForLesson('missing');

      expect(roster).toEqual({
        students: [],
        groups: [],
        total: 0,
        hasMore: false,
        teacherId: null,
      });
    });
  });
});
