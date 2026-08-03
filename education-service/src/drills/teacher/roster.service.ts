import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthClientService } from '../../auth-client/auth-client.service';
import { DrillTeacherRosterQuery, DrillTeacherRosterResponse } from '../contracts';

/** Page size when the caller asks for none. A picker shows a window, not 656 rows. */
const DEFAULT_ROSTER_LIMIT = 50;
/** Ceiling on an explicit `limit`, so one request cannot ask for the whole roster. */
const MAX_ROSTER_LIMIT = 200;

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
 * Read from this service's own tables, except names: education-service stores
 * `studentId` integers and nothing else about a person, so names are resolved in batch
 * from auth-microservice. Previously `name` was returned empty and the assignment wizard
 * rendered "Student 58" for every one of teacher 10's 656 students.
 *
 * Paged and searchable for the same reason — 656 students in one payload is not a picker.
 */
@Injectable()
export class TeacherRosterService {
  private readonly logger = new Logger(TeacherRosterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthClientService,
  ) {}

  async listForTeacher(
    teacherId: number,
    query: DrillTeacherRosterQuery = {},
  ): Promise<DrillTeacherRosterResponse> {
    const lessons = await this.prisma.lesson.findMany({
      where: { teacherId },
      select: { studentCourseUuid: true },
      distinct: ['studentCourseUuid'],
    });

    if (lessons.length === 0) {
      this.logger.warn(`Teacher ${teacherId} has no lessons; roster is empty`);
      return { students: [], groups: [], total: 0, hasMore: false };
    }

    const courses = await this.prisma.studentCourse.findMany({
      where: { uuid: { in: lessons.map((lesson) => lesson.studentCourseUuid) } },
      select: { groupUuid: true },
      distinct: ['groupUuid'],
    });

    const groupUuids = courses.map((course) => course.groupUuid);
    if (groupUuids.length === 0) {
      return { students: [], groups: [], total: 0, hasMore: false };
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

    const allStudentIds = Array.from(groupUuidsByStudent.keys()).sort((a, b) => a - b);

    // Names come from auth-microservice; this service has none. Resolved for the whole
    // roster before filtering because `search` matches on the NAME, which is not known
    // here until it is fetched — paging first would search only the current window.
    const names = await this.auth.resolveLegacyNames(allStudentIds);

    const search = (query.search ?? '').trim().toLowerCase();
    const matching = allStudentIds.filter((id) => {
      if (!search) {
        return true;
      }
      const name = names.get(id);
      // An unnamed student is matched by id, so a teacher can still find someone whose
      // auth mapping is missing rather than having them vanish from the picker.
      return name ? name.toLowerCase().includes(search) : String(id).includes(search);
    });

    // Named students first, alphabetically; unnamed ones after, by id. A picker that
    // opens on "Student 58" when real names exist reads as broken.
    const sorted = matching.sort((a, b) => {
      const nameA = names.get(a);
      const nameB = names.get(b);
      if (nameA && nameB) return nameA.localeCompare(nameB);
      if (nameA) return -1;
      if (nameB) return 1;
      return a - b;
    });

    const offset = Math.max(0, query.offset ?? 0);
    const limit = Math.min(Math.max(1, query.limit ?? DEFAULT_ROSTER_LIMIT), MAX_ROSTER_LIMIT);
    const page = sorted.slice(offset, offset + limit);

    this.logger.log(
      `Roster for teacher ${teacherId}: total=${sorted.length} named=${names.size} returned=${page.length} offset=${offset}`,
    );

    return {
      students: page.map((id) => ({
        id,
        // Empty only when auth has no mapping for this legacy id. The frontend's
        // "Student <id>" fallback still covers that case.
        name: names.get(id) ?? '',
        groupUuids: groupUuidsByStudent.get(id) ?? [],
      })),
      groups: groups.map((group) => ({
        uuid: group.uuid,
        name: group.title,
        studentIds: group.groupStudents.map((link) => link.studentId),
      })),
      total: sorted.length,
      hasMore: offset + page.length < sorted.length,
    };
  }
}
