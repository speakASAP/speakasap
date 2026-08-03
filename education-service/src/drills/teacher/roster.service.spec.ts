import { TeacherRosterService } from './roster.service';

function harness() {
  const prisma: any = {
    lesson: { findMany: jest.fn(async () => []) },
    studentCourse: { findMany: jest.fn(async () => []) },
    group: { findMany: jest.fn(async () => []) },
  };
  return { service: new TeacherRosterService(prisma), prisma };
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

    await expect(h.service.listForTeacher(99)).resolves.toEqual({ students: [], groups: [] });
    expect(h.prisma.studentCourse.findMany).not.toHaveBeenCalled();
    expect(h.prisma.group.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty roster when the lessons map to no groups', async () => {
    const h = harness();
    h.prisma.lesson.findMany.mockResolvedValue([{ studentCourseUuid: 'c-1' }]);
    h.prisma.studentCourse.findMany.mockResolvedValue([]);

    await expect(h.service.listForTeacher(99)).resolves.toEqual({ students: [], groups: [] });
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

  // education-service stores studentId integers and nothing about the person. Inventing
  // a name here would be wrong in a way the caller could not detect.
  it('leaves the name empty rather than fabricating one', async () => {
    const h = harness();
    h.prisma.lesson.findMany.mockResolvedValue([{ studentCourseUuid: 'c-1' }]);
    h.prisma.studentCourse.findMany.mockResolvedValue([{ groupUuid: 'g-1' }]);
    h.prisma.group.findMany.mockResolvedValue([
      { uuid: 'g-1', title: 'A', groupStudents: [{ studentId: 7 }] },
    ]);

    const roster = await h.service.listForTeacher(99);
    expect(roster.students[0].name).toBe('');
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
});
