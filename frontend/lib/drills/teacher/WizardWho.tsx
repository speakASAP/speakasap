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
  onNext: (value: WizardWhoValue) => void;
}

/**
 * Step "Who": which students the drill is for, and which lesson it belongs to.
 *
 * One student, several, or a whole group. Picking a group expands to its student ids
 * rather than sending a group reference, so an assignment stays attached to the students
 * who were in the group at the moment the teacher assigned it — later membership changes
 * must not retroactively add or remove someone's homework.
 */
export function WizardWho({ students, groups = [], lessons = [], onNext }: WizardWhoProps) {
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [lessonUuid, setLessonUuid] = useState('');

  const toggleStudent = (id: number) => {
    setStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectGroup = (group: WizardGroup) => {
    setStudentIds((prev) => Array.from(new Set([...prev, ...group.studentIds])));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (studentIds.length === 0) {
          return;
        }
        onNext({ studentIds, lessonUuid: lessonUuid || null });
      }}
    >
      <fieldset>
        <legend>Students</legend>
        <ul>
          {students.map((student) => (
            <li key={student.id}>
              <label>
                <input
                  type="checkbox"
                  checked={studentIds.includes(student.id)}
                  onChange={() => toggleStudent(student.id)}
                />
                {student.name}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {groups.length > 0 ? (
        <fieldset>
          <legend>Groups</legend>
          <ul>
            {groups.map((group) => (
              <li key={group.id}>
                <button type="button" onClick={() => selectGroup(group)}>
                  Add {group.name}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <label htmlFor="drill-lesson">Lesson (optional)</label>
      <select
        id="drill-lesson"
        value={lessonUuid}
        onChange={(e) => setLessonUuid(e.target.value)}
      >
        <option value="">No lesson</option>
        {lessons.map((lesson) => (
          <option key={lesson.uuid} value={lesson.uuid}>
            {lesson.title}
          </option>
        ))}
      </select>

      <button type="submit" disabled={studentIds.length === 0}>
        Next
      </button>
    </form>
  );
}
