import { Injectable, Logger } from '@nestjs/common';
import { AuthClientService } from '../../auth-client/auth-client.service';
import { DrillTeacherRosterQuery, DrillTeacherRosterResponse } from '../contracts';
import { LessonClientService } from '../../lesson-client/lesson-client.service';
import { courseLanguageOf, CourseLanguage } from './course-language';

/** Page size when the caller asks for none. A picker shows a window, not 656 rows. */
const DEFAULT_ROSTER_LIMIT = 50;
/** Ceiling on an explicit `limit`, so one request cannot ask for the whole roster. */
const MAX_ROSTER_LIMIT = 200;

/**
 * The students a teacher may assign drilling to, for one lesson.
 *
 * Always lesson-scoped. There is no teacher column on `Group` — the legacy Django shape
 * puts the teacher on the individual `Lesson` — so a teacher-wide roster used to be
 * derived by walking lessons to student courses to groups. That walk read a COPY of the
 * portal's tables whose ETL last ran 2026-06-26, so a teacher whose lessons are all
 * newer got an empty roster and a warning-level log. It was removed on 2026-08-09 along
 * with `listForTeacher`: the portal answers per lesson, and the wizard only ever opens
 * from a lesson page.
 *
 * Names are resolved separately: education-service stores `studentId` integers and
 * nothing else about a person, so names come in batch from auth-microservice. Without
 * that the wizard rendered "Student 58" for every one of teacher 10's 656 students.
 *
 * Paged and searchable for the same reason — 656 students in one payload is not a picker.
 */
@Injectable()
export class TeacherRosterService {
  private readonly logger = new Logger(TeacherRosterService.name);

  constructor(
    private readonly auth: AuthClientService,
    private readonly lessons: LessonClientService,
  ) {}

  /**
   * The roster of one lesson, as reported by the portal.
   *
   * The portal owns lessons; this service holds no lesson tables. `Lesson.teacherId` is
   * the legacy **Teacher profile pk** (182 for the user whose auth id resolves to 3),
   * and `employees_teacher` lives in the portal's database — so the lesson naming its
   * own teacher and students is what sidesteps the id-space mismatch.
   *
   * The caller is already proven staff by the JWT before this runs, so scoping to a
   * lesson narrows a staff member to that lesson's students rather than widening access.
   *
   * RAISES rather than returning an empty roster. Until 2026-08-09 a lesson this service
   * could not see produced `{students: []}` and a warning-level log, which a teacher
   * reads as "this lesson has no students" — indistinguishable from an empty group. That
   * ambiguity hid a frozen lesson table for six weeks. An empty roster now means only
   * one thing: the group really is empty.
   */
  async listForLesson(
    lessonUuid: string,
    query: DrillTeacherRosterQuery = {},
  ): Promise<
    DrillTeacherRosterResponse & {
      teacherId: number | null;
      languageCode: string | null;
      materialLanguage: string | null;
    }
  > {
    const roster = await this.lessons.getRoster(lessonUuid);

    // The course's language, so the wizard can offer that language's topics. It used to
    // hardcode German, which put `adjektivgruppen` in front of an English student.
    //
    // Fail-soft ONLY here, and deliberately: the roster is what the wizard cannot work
    // without, while the language merely narrows a picker the teacher can also type
    // into. Losing the student list because a second lookup failed would be a worse
    // outcome than an unfiltered topic list. The failure is logged at error level and
    // surfaced as an explicit null, never as a silent default language.
    let language: CourseLanguage | null = null;
    try {
      const lesson = await this.lessons.getLesson(lessonUuid);
      language = courseLanguageOf(lesson.moduleClass, lesson.courseClass);
      if (!language) {
        this.logger.warn(
          `Lesson ${lessonUuid} names no language pair (moduleClass=${JSON.stringify(lesson.moduleClass)} ` +
            `courseClass=${JSON.stringify(lesson.courseClass)}); ` +
            'the topic picker will not be filtered',
        );
      }
    } catch (err) {
      this.logger.error(
        `Could not read the course language for lesson ${lessonUuid}; returning the roster ` +
          `without it: ${(err as Error).message}`,
      );
    }

    const groupUuidsByStudent = new Map<number, string[]>();
    for (const group of roster.groups) {
      for (const studentId of group.studentIds) {
        const existing = groupUuidsByStudent.get(studentId);
        if (existing) {
          existing.push(group.uuid);
        } else {
          groupUuidsByStudent.set(studentId, [group.uuid]);
        }
      }
    }

    // The portal's student_ids is authoritative for membership; the group map only
    // supplies which groups each one belongs to.
    const page = await this.pageStudents(
      roster.studentIds,
      groupUuidsByStudent,
      query,
      roster.names,
    );

    return {
      ...page,
      groups: roster.groups.map((group) => ({
        uuid: group.uuid,
        name: group.name,
        studentIds: group.studentIds,
      })),
      teacherId: roster.teacherId,
      languageCode: language?.languageCode ?? null,
      materialLanguage: language?.materialLanguage ?? null,
    };
  }

  /**
   * Names, search, sort and paging over a set of student ids.
   *
   * `groups` is left empty here and filled in by the caller, which knows where its
   * groups came from. Callers spread this result first and set `groups` after.
   *
   * `fallbackNames` covers students auth has never seen — see the merge below.
   */
  private async pageStudents(
    studentIds: number[],
    groupUuidsByStudent: Map<number, string[]>,
    query: DrillTeacherRosterQuery,
    fallbackNames: Map<number, string> = new Map(),
  ): Promise<DrillTeacherRosterResponse> {
    const allStudentIds = [...new Set(studentIds)].sort((a, b) => a - b);

    // Names come from auth-microservice; this service has none. Resolved for the whole
    // roster before filtering because `search` matches on the NAME, which is not known
    // here until it is fetched — paging first would search only the current window.
    const resolved = await this.auth.resolveLegacyNames(allStudentIds);

    // auth wins where it knows the person — it is the platform's identity store. But it
    // only holds users migrated up to legacy id 314012, so anyone who registered on the
    // portal after that has no auth record and used to render as "Student 314082". The
    // portal knows them, so its name fills the gap.
    //
    // Merged BEFORE filtering, so `search` matches a fallback name too: a teacher who
    // can see a student in the list must be able to find them by typing that name.
    const names = new Map(fallbackNames);
    for (const [id, name] of resolved) {
      if (name) {
        names.set(id, name);
      }
    }

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
      // named_by_portal counts students auth could not name — a rising number means the
      // auth migration is falling further behind portal registrations.
      `Roster: total=${sorted.length} named=${names.size} named_by_auth=${resolved.size} ` +
        `named_by_portal=${names.size - resolved.size} returned=${page.length} offset=${offset}`,
    );

    return {
      students: page.map((id) => ({
        id,
        // Empty only when auth has no mapping for this legacy id. The frontend's
        // "Student <id>" fallback still covers that case.
        name: names.get(id) ?? '',
        groupUuids: groupUuidsByStudent.get(id) ?? [],
      })),
      groups: [],
      total: sorted.length,
      hasMore: offset + page.length < sorted.length,
    };
  }
}
