import { TeacherRosterService } from './roster.service';
import {
  LessonNotFoundError,
  LessonServiceUnavailableError,
} from '../../lesson-client/lesson-client.types';

function harness(names: Map<number, string> = new Map()) {
  const auth: any = { resolveLegacyNames: jest.fn(async () => names) };
  // Defaults to raising: an unstubbed lesson lookup must never silently succeed with
  // an empty roster, which is the exact bug this whole change removes.
  const lessons: any = {
    getRoster: jest.fn(async () => {
      throw new LessonServiceUnavailableError('unstubbed', 'test did not stub getRoster');
    }),
    // Defaults to a lesson with no language pair, so a test that does not care about the
    // language gets nulls rather than an unexpected raise.
    getLesson: jest.fn(async () => ({ uuid: 'l-1', moduleClass: '' })),
  };
  return { service: new TeacherRosterService(auth, lessons), auth, lessons };
}

/**
 * Name resolution, search, sort and paging.
 *
 * These used to run through `listForTeacher`, which walked the local copies of the
 * portal's lesson tables. That method was deleted on 2026-08-09 — the copy had been
 * frozen since 2026-06-26 — so the same behaviour is asserted through `listForLesson`,
 * which is the only entry point left. The logic under test (`pageStudents`) is unchanged.
 */
describe('TeacherRosterService roster shaping', () => {
  const LESSON = 'l-1';

  function rosterOf(ids: number[], names: Map<number, string>) {
    const h = harness(names);
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON,
      teacherId: 182,
      groups: [{ uuid: 'g-1', name: 'A', studentIds: ids }],
      studentIds: ids,
      paidStudentIds: ids,
    });
    return h;
  }

  it('lists a student in two groups exactly once, carrying both group uuids', async () => {
    // One person in two of the lesson's groups is one row, not two students sharing an id.
    const h = harness(new Map([[7, 'Anna']]));
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON,
      teacherId: 182,
      groups: [
        { uuid: 'g-1', name: 'Tuesday A2', studentIds: [7] },
        { uuid: 'g-2', name: 'Thursday A2', studentIds: [7] },
      ],
      studentIds: [7, 7],
      paidStudentIds: [7],
    });

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.students).toHaveLength(1);
    expect(roster.students[0].groupUuids).toEqual(['g-1', 'g-2']);
  });

  it('handles a group with no students', async () => {
    const h = rosterOf([], new Map());

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.students).toEqual([]);
    expect(roster.total).toBe(0);
  });

  it('fills names resolved from auth', async () => {
    const h = rosterOf([7, 8], new Map([[7, 'Anna Novak'], [8, 'Boris Petrov']]));

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.students.map((s) => s.name)).toEqual(['Anna Novak', 'Boris Petrov']);
    expect(h.auth.resolveLegacyNames).toHaveBeenCalledWith([7, 8]);
  });

  // One call for the whole roster, not one per student — 656 students would otherwise
  // be 656 round trips to build a single picker.
  it('resolves the whole roster in one batch call', async () => {
    const h = rosterOf([7, 8, 9], new Map());
    await h.service.listForLesson(LESSON);
    expect(h.auth.resolveLegacyNames).toHaveBeenCalledTimes(1);
  });

  it('sorts named students alphabetically, unnamed ones last by id', async () => {
    const h = rosterOf([9, 7, 8], new Map([[9, 'Anna'], [7, 'Zoe']]));

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.students.map((s) => s.id)).toEqual([9, 7, 8]);
  });

  it('pages, reporting the pre-page total and whether more remain', async () => {
    const h = rosterOf([1, 2, 3, 4, 5], new Map());

    const first = await h.service.listForLesson(LESSON, { limit: 2, offset: 0 });
    expect(first.students.map((s) => s.id)).toEqual([1, 2]);
    expect(first.total).toBe(5);
    expect(first.hasMore).toBe(true);

    const last = await h.service.listForLesson(LESSON, { limit: 2, offset: 4 });
    expect(last.students.map((s) => s.id)).toEqual([5]);
    expect(last.hasMore).toBe(false);
  });

  it('searches on the resolved name, case-insensitively', async () => {
    const h = rosterOf([7, 8], new Map([[7, 'Anna Novak'], [8, 'Boris Petrov']]));

    const roster = await h.service.listForLesson(LESSON, { search: 'nOvAk' });

    expect(roster.students.map((s) => s.id)).toEqual([7]);
    expect(roster.total).toBe(1);
  });

  // Searching after paging would only ever search the current window.
  it('searches the whole roster, not just the first page', async () => {
    const h = rosterOf([1, 2, 3, 4, 5], new Map([[5, 'Zoe Last']]));

    const roster = await h.service.listForLesson(LESSON, { search: 'zoe', limit: 2 });

    expect(roster.students.map((s) => s.id)).toEqual([5]);
  });

  it('falls back to matching the id for a student auth cannot name', async () => {
    const h = rosterOf([58, 111], new Map());

    const roster = await h.service.listForLesson(LESSON, { search: '111' });

    expect(roster.students.map((s) => s.id)).toEqual([111]);
  });

  // A picker showing ids is poor; a picker that will not open is worse. Names are
  // cosmetic, so auth degrading is allowed here — the roster itself is not.
  it('degrades to ids rather than failing when auth is unreachable', async () => {
    const h = rosterOf([7, 8], new Map());
    h.auth.resolveLegacyNames.mockResolvedValue(new Map());

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.students.map((s) => s.id)).toEqual([7, 8]);
    expect(roster.students.every((s) => s.name === '')).toBe(true);
  });

  it('caps an oversized limit rather than returning the whole roster', async () => {
    const h = rosterOf([1, 2, 3], new Map());

    const roster = await h.service.listForLesson(LESSON, { limit: 100000 });

    expect(roster.students).toHaveLength(3);
    expect(roster.hasMore).toBe(false);
  });

  it('falls back to the portal name when auth cannot name the student', async () => {
    // Tetiana registered on the portal after auth's migration cutoff (legacy id 314012),
    // so auth has no record and the wizard rendered "Student 314082".
    const h = harness(new Map());
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [{ uuid: 'g-1', name: 'G', studentIds: [314082] }],
      studentIds: [314082], paidStudentIds: [314082],
      names: new Map([[314082, 'Tetiana Kovach']]),
    });

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.students[0].name).toBe('Tetiana Kovach');
  });

  it('prefers auth over the portal when both name the student', async () => {
    // auth is the platform's own identity store; the portal name is a stopgap for
    // students it has never seen. Where both know a person, auth wins.
    const h = harness(new Map([[314082, 'Auth Name']]));
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [{ uuid: 'g-1', name: 'G', studentIds: [314082] }],
      studentIds: [314082], paidStudentIds: [314082],
      names: new Map([[314082, 'Portal Name']]),
    });

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.students[0].name).toBe('Auth Name');
  });

  it('searches on the portal-supplied name too', async () => {
    // Search matches on the NAME. If the fallback name were applied after filtering, a
    // teacher could see a student in the list and fail to find them by typing it.
    const h = harness(new Map());
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [{ uuid: 'g-1', name: 'G', studentIds: [314082, 999] }],
      studentIds: [314082, 999], paidStudentIds: [],
      names: new Map([[314082, 'Tetiana Kovach']]),
    });

    const roster = await h.service.listForLesson(LESSON, { search: 'kovach' });

    expect(roster.students.map((s) => s.id)).toEqual([314082]);
  });

  it('reports the course language so the wizard stops hardcoding German', async () => {
    // An English course offered German topics because the wizard asked for ('de','ru')
    // regardless of the lesson. The lesson knows: module_class carries the pair.
    const h = harness(new Map());
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [], studentIds: [], paidStudentIds: [], names: new Map(),
    });
    h.lessons.getLesson.mockResolvedValue({
      uuid: LESSON, moduleClass: 'course_materials.data.ru.en._basic_s.Module3T',
    });

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.languageCode).toBe('en');
    expect(roster.materialLanguage).toBe('ru');
  });

  it('resolves an extra-lessons lesson from its course class', async () => {
    // The lesson's own module class names no language; the course it belongs to does.
    // Without this, drilling was refused on all 11,787 extra-lessons lessons.
    const h = harness(new Map());
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [], studentIds: [], paidStudentIds: [], names: new Map(),
    });
    h.lessons.getLesson.mockResolvedValue({
      uuid: LESSON,
      moduleClass: 'course_materials.data.extra_lessons.ModuleExtraLessonsCourse',
      courseClass: 'course_materials.data.ru.it._extra.Course',
    });

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.languageCode).toBe('it');
    expect(roster.materialLanguage).toBe('ru');
  });

  it('reports nulls when the lesson names no language pair', async () => {
    // extra_lessons courses encode none. Null is surfaced so the caller can say so,
    // rather than a default that would silently pick a language.
    const h = harness(new Map());
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [], studentIds: [], paidStudentIds: [], names: new Map(),
    });
    h.lessons.getLesson.mockResolvedValue({
      uuid: LESSON,
      moduleClass: 'course_materials.data.extra_lessons.ModuleExtraLessonsCourse',
      courseClass: '',
    });

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.languageCode).toBeNull();
    expect(roster.materialLanguage).toBeNull();
  });

  it('still returns the roster when the lesson lookup fails', async () => {
    // The language is a nicety; the roster is the point. A teacher must not lose their
    // student picker because the language could not be determined.
    const h = harness(new Map([[3, 'Ann']]));
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [{ uuid: 'g-1', name: 'G', studentIds: [3] }],
      studentIds: [3], paidStudentIds: [3], names: new Map(),
    });
    h.lessons.getLesson.mockRejectedValue(new LessonServiceUnavailableError(LESSON, 'boom'));

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.students.map((s) => s.id)).toEqual([3]);
    expect(roster.languageCode).toBeNull();
  });

  it('reports the lesson teacher so the caller can attribute the assignment', async () => {
    const h = rosterOf([7], new Map());

    const roster = await h.service.listForLesson(LESSON);

    expect(roster.teacherId).toBe(182);
  });

  it('RAISES for a lesson that does not exist, rather than emptying the roster', async () => {
    // INVERTED 2026-08-09. This used to assert that a nonexistent lesson yields an empty
    // roster, which encoded the defect as the contract: education-service read a COPY of
    // the lesson tables whose ETL last ran 2026-06-26, so every lesson created after that
    // date looked "nonexistent" and every teacher saw an empty student list with no error
    // anywhere. A green test kept the bug invisible for six weeks.
    const h = harness();
    h.lessons.getRoster.mockRejectedValue(new LessonNotFoundError('missing'));

    await expect(h.service.listForLesson('missing')).rejects.toBeInstanceOf(LessonNotFoundError);
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

  /**
   * Structural rather than behavioural, and deliberately so: the service no longer
   * accepts a PrismaService at all, so there is no local lesson table it *could* read.
   * Reinstating one would fail to compile before it could fail a test.
   */
  it('holds no database handle, so it cannot read a local lesson table', async () => {
    const h = harness(new Map([[3, 'Ann']]));
    h.lessons.getRoster.mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [{ uuid: 'g-1', name: 'G', studentIds: [3] }],
      studentIds: [3], paidStudentIds: [3],
    });

    await h.service.listForLesson(LESSON);

    expect(TeacherRosterService.length).toBe(2);
    expect(Object.values(h.service as unknown as Record<string, unknown>)).not.toContainEqual(
      expect.objectContaining({ lesson: expect.anything() }),
    );
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
