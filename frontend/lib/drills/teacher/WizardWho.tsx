'use client';

import { useState } from 'react';

export interface WizardStudent {
  id: number;
  name: string;
}

export interface WizardGroup {
  id: string;
  name: string;
  studentIds: number[];
}

export interface WizardWhoValue {
  studentIds: number[];
  lessonUuid: string | null;
}

export interface WizardWhoProps {
  students: WizardStudent[];
  groups?: WizardGroup[];
  lessons?: { uuid: string; title: string }[];
  /**
   * Students to check on arrival — from `?studentId=` when the teacher came from a
   * portal lesson page. Ids not on this teacher's roster are dropped: the server would
   * reject them anyway, and carrying one silently is worse than ignoring it.
   */
  initialStudentIds?: number[];
  /** Lesson to preselect — from `?lessonUuid=`. */
  initialLessonUuid?: string | null;
  /**
   * Human title for `initialLessonUuid`. The wizard does not fetch a lesson list — a
   * teacher's is large and only the lesson they arrived from matters — so without this
   * the preselected lesson would have no visible option to render.
   */
  initialLessonTitle?: string | null;
  onNext: (value: WizardWhoValue) => void;
}

/**
 * Step "Who": which students the drill is for, and which lesson it belongs to.
 *
 * One student, several, or a whole group. Picking a group expands to its student ids
 * rather than sending a group reference, so an assignment stays attached to the students
 * who were in the group at the moment the teacher assigned it — later membership changes
 * must not retroactively add or remove someone's homework. The backend creates one
 * assignment row per student, so a group is a selection shortcut, never a unit of work.
 *
 * Arriving from a lesson page preselects that student and lesson but leaves the picker
 * open: the common case is one student, and the occasional "actually, both of them" is
 * cheaper to allow than to force a restart.
 */
export function WizardWho({
  students,
  groups = [],
  lessons = [],
  initialStudentIds = [],
  initialLessonUuid = null,
  initialLessonTitle = null,
  onNext,
}: WizardWhoProps) {
  const [studentIds, setStudentIds] = useState<number[]>(() =>
    initialStudentIds.filter((id) => students.some((s) => s.id === id)),
  );

  // A studentId arrived but matched nobody: this teacher does not teach that student, so
  // the lesson belongs to someone else. Saying so beats rendering an unfiltered picker
  // that looks as though the parameter was never passed.
  const preselectionMissed =
    initialStudentIds.length > 0 &&
    students.length > 0 &&
    !initialStudentIds.some((id) => students.some((s) => s.id === id));
  const [lessonUuid, setLessonUuid] = useState(initialLessonUuid ?? '');

  const toggleStudent = (id: number) => {
    setStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectGroup = (group: WizardGroup) => {
    setStudentIds((prev) => Array.from(new Set([...prev, ...group.studentIds])));
  };

  const selectedNames = students
    .filter((s) => studentIds.includes(s.id))
    .map((s) => s.name);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (studentIds.length === 0) {
          return;
        }
        onNext({ studentIds, lessonUuid: lessonUuid || null });
      }}
    >
      {preselectionMissed ? (
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          That student is not on your roster, so nothing was preselected. You only see
          students from lessons you teach — this lesson may belong to another teacher.
        </p>
      ) : null}

      <fieldset className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <legend className="px-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Students
        </legend>

        {students.length === 0 ? (
          <p className="py-2 text-sm text-zinc-500">
            No students on your roster yet.
          </p>
        ) : (
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {students.map((student) => {
              const checked = studentIds.includes(student.id);
              return (
                <li key={student.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      checked
                        ? 'bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-sky-600"
                      checked={checked}
                      onChange={() => toggleStudent(student.id)}
                    />
                    <span className="truncate">{student.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {selectedNames.length > 0 ? (
          <p className="mt-3 border-t border-zinc-100 pt-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            {/* Named, not counted: "3 selected" hides which three. */}
            Assigning to <span className="font-medium">{selectedNames.join(', ')}</span>
          </p>
        ) : null}
      </fieldset>

      {groups.length > 0 ? (
        <fieldset className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <legend className="px-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Groups
          </legend>
          <p className="mb-2 text-xs text-zinc-500">
            Adds everyone in the group to the selection above. Each student still gets
            their own assignment.
          </p>
          <ul className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 transition-colors hover:border-sky-400 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={() => selectGroup(group)}
                >
                  Add {group.name}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label
          htmlFor="drill-lesson"
          className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          Lesson (optional)
        </label>
        <select
          id="drill-lesson"
          className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          value={lessonUuid}
          onChange={(e) => setLessonUuid(e.target.value)}
        >
          <option value="">No lesson</option>
          {/*
            The lesson the teacher arrived from, when it is not in `lessons`. Without an
            option carrying this value the select renders as "No lesson" while state still
            holds the uuid — the control would contradict what gets submitted.
          */}
          {initialLessonUuid && !lessons.some((l) => l.uuid === initialLessonUuid) ? (
            <option value={initialLessonUuid}>
              {initialLessonTitle || 'The lesson you came from'}
            </option>
          ) : null}
          {lessons.map((lesson) => (
            <option key={lesson.uuid} value={lesson.uuid}>
              {lesson.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={studentIds.length === 0}
        >
          Next
        </button>
      </div>
    </form>
  );
}
