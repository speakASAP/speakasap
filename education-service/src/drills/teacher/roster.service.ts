import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DrillTeacherRosterResponse } from '../contracts';

/**
 * The students a teacher may assign drilling to.
 *
 * There is no teacher column on `Group` — the legacy Django shape puts the teacher on
 * the individual `Lesson`. So a teacher's roster is derived: the lessons they teach give
 * the student courses, the courses give the groups, and the groups give the students.
 *
 * That indirection is why this is a service rather than one `findMany`. It also means
 * the roster is "students I have taught or am scheduled to teach", which is the right
 * definition for this purpose — a teacher assigning homework to someone whose lesson
 * they have never been booked for is the case worth excluding.
 *
 * Read from this service's own tables. Names are not available here: education-service
 * stores `studentId` integers and nothing else about a person, so `name` is left to the
 * caller to resolve (the same reason `listForLesson` returns an empty `studentName`).
 */
@Injectable()
export class TeacherRosterService {
  private readonly logger = new Logger(TeacherRosterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listForTeacher(teacherId: number): Promise<DrillTeacherRosterResponse> {
    const lessons = await this.prisma.lesson.findMany({
      where: { teacherId },
      select: { studentCourseUuid: true },
      distinct: ['studentCourseUuid'],
    });

    if (lessons.length === 0) {
      this.logger.warn(`Teacher ${teacherId} has no lessons; roster is empty`);
      return { students: [], groups: [] };
    }

    const courses = await this.prisma.studentCourse.findMany({
      where: { uuid: { in: lessons.map((lesson) => lesson.studentCourseUuid) } },
      select: { groupUuid: true },
      distinct: ['groupUuid'],
    });

    const groupUuids = courses.map((course) => course.groupUuid);
    if (groupUuids.length === 0) {
      return { students: [], groups: [] };
    }

    const groups = await this.prisma.group.findMany({
      where: { uuid: { in: groupUuids } },
      select: {
        uuid: true,
        title: true,
        groupStudents: { select: { studentId: true } },
      },
      orderBy: { title: 'asc' },
    });

    // A student in two of the teacher's groups appears once in `students` and in both
    // groups' `studentIds` — the wizard de-duplicates on selection, and a roster that
    // listed them twice would look like two different people.
    const groupUuidsByStudent = new Map<number, string[]>();
    for (const group of groups) {
      for (const link of group.groupStudents) {
        const existing = groupUuidsByStudent.get(link.studentId);
        if (existing) {
          existing.push(group.uuid);
        } else {
          groupUuidsByStudent.set(link.studentId, [group.uuid]);
        }
      }
    }

    return {
      students: Array.from(groupUuidsByStudent.entries())
        .sort(([a], [b]) => a - b)
        .map(([id, uuids]) => ({
          id,
          // education-service holds no names. The caller joins against auth or the
          // portal; an empty string here is the same contract `listForLesson` uses.
          name: '',
          groupUuids: uuids,
        })),
      groups: groups.map((group) => ({
        uuid: group.uuid,
        name: group.title,
        studentIds: group.groupStudents.map((link) => link.studentId),
      })),
    };
  }
}
