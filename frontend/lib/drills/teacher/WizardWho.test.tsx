import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardWho } from './WizardWho';

afterEach(cleanup);

const students = [
  { id: 1, name: 'Anna' },
  { id: 2, name: 'Boris' },
];

describe('WizardWho', () => {
  it('cannot continue with nobody selected', () => {
    render(<WizardWho students={students} onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('assigns to one student', async () => {
    const onNext = vi.fn();
    render(<WizardWho students={students} initialLessonUuid="l-1" onNext={onNext} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ studentIds: [1], lessonUuid: 'l-1' });
  });

  it('assigns to several students', async () => {
    const onNext = vi.fn();
    render(<WizardWho students={students} initialLessonUuid="l-1" onNext={onNext} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /boris/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ studentIds: [1, 2], lessonUuid: 'l-1' });
  });

  // The group expands now rather than travelling as a reference, so a later membership
  // change cannot retroactively add or remove someone's homework.
  it('expands a group to the students in it, without duplicating an existing pick', async () => {
    const onNext = vi.fn();
    render(
      <WizardWho
        students={students}
        groups={[{ id: 'g-1', name: 'Tuesday A2', studentIds: [1, 2] }]}
        initialLessonUuid="l-1"
        onNext={onNext}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));
    await userEvent.click(screen.getByRole('button', { name: /add tuesday a2/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ studentIds: [1, 2], lessonUuid: 'l-1' });
  });

  it('passes the chosen lesson through', async () => {
    const onNext = vi.fn();
    render(
      <WizardWho
        students={students}
        lessons={[{ uuid: 'l-1', title: 'Lesson 5' }]}
        onNext={onNext}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));
    await userEvent.selectOptions(screen.getByLabelText(/lesson/i), 'l-1');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ studentIds: [1], lessonUuid: 'l-1' });
  });

  /**
   * Replaces "sends null rather than an empty string when no lesson is chosen".
   * Teacher-origin work is created within a lesson, and the server refuses a missing one
   * with 400 LESSON_REQUIRED — so the wizard must not offer to submit without it.
   */
  it('cannot continue without a lesson, however many students are picked', async () => {
    const onNext = vi.fn();
    render(
      <WizardWho
        students={students}
        lessons={[{ uuid: 'l-1', title: 'Lesson 5' }]}
        onNext={onNext}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('enables Next only once both a student and a lesson are chosen', async () => {
    const onNext = vi.fn();
    render(
      <WizardWho
        students={students}
        lessons={[{ uuid: 'l-1', title: 'Lesson 5' }]}
        onNext={onNext}
      />,
    );
    const next = () => screen.getByRole('button', { name: /next/i });
    expect(next()).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));
    expect(next()).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText(/lesson/i), 'l-1');
    expect(next()).toBeEnabled();
  });

  it('offers no "no lesson" escape hatch', () => {
    render(
      <WizardWho
        students={students}
        lessons={[{ uuid: 'l-1', title: 'Lesson 5' }]}
        onNext={vi.fn()}
      />,
    );
    expect(screen.queryByRole('option', { name: /no lesson/i })).toBeNull();
  });

  /**
   * Opened from a portal lesson page, the URL carries ?studentId=&lessonUuid=. Before
   * this, both were ignored: a teacher who clicked "create drilling assignment" for one
   * student landed on an empty picker and had to find them again in a 656-name roster.
   */
  describe('preselection from the lesson page', () => {
    it('preselects the student the teacher came in for', () => {
      render(
        <WizardWho students={students} initialStudentIds={[2]} onNext={vi.fn()} />,
      );

      expect(screen.getByRole('checkbox', { name: /boris/i })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /anna/i })).not.toBeChecked();
    });

    it('can continue immediately, without touching the picker', async () => {
      const onNext = vi.fn();
      render(
        <WizardWho
          students={students}
          initialStudentIds={[2]}
          initialLessonUuid="l-1"
          onNext={onNext}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(onNext).toHaveBeenCalledWith({ studentIds: [2], lessonUuid: 'l-1' });
    });

    it('preselects the lesson too', async () => {
      const onNext = vi.fn();
      render(
        <WizardWho
          students={students}
          lessons={[{ uuid: 'l-1', title: 'Lesson 12' }]}
          initialStudentIds={[1]}
          initialLessonUuid="l-1"
          onNext={onNext}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(onNext).toHaveBeenCalledWith({ studentIds: [1], lessonUuid: 'l-1' });
    });

    it('still lets the teacher add someone else', async () => {
      const onNext = vi.fn();
      render(
        <WizardWho
          students={students}
          initialStudentIds={[1]}
          initialLessonUuid="l-1"
          onNext={onNext}
        />,
      );

      await userEvent.click(screen.getByRole('checkbox', { name: /boris/i }));
      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(onNext).toHaveBeenCalledWith({ studentIds: [1, 2], lessonUuid: 'l-1' });
    });

    it('still lets the teacher deselect the preselected student', async () => {
      const onNext = vi.fn();
      render(
        <WizardWho students={students} initialStudentIds={[1]} onNext={onNext} />,
      );

      await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));

      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
      expect(onNext).not.toHaveBeenCalled();
    });

    it('ignores a preselected id that is not on this teacher roster', () => {
      // A studentId in the URL that this teacher may not assign to must not become a
      // selection — the server would reject it, and silently carrying it is worse.
      render(
        <WizardWho students={students} initialStudentIds={[9999]} onNext={vi.fn()} />,
      );

      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });
  });

  /**
   * The lesson dropdown is populated from `lessons`, which the page does not fetch — a
   * teacher's lesson list is large and the wizard only ever needs the one they came from.
   * So a preselected uuid with no matching option silently fell back to "No lesson" and
   * the assignment lost its lesson link.
   */
  describe('a preselected lesson that is not in the list', () => {
    it('keeps the lesson rather than falling back to "No lesson"', async () => {
      const onNext = vi.fn();
      render(
        <WizardWho
          students={students}
          lessons={[]}
          initialStudentIds={[1]}
          initialLessonUuid="l-from-url"
          onNext={onNext}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(onNext).toHaveBeenCalledWith({ studentIds: [1], lessonUuid: 'l-from-url' });
    });

    it('shows the lesson so the teacher can see it is attached', () => {
      render(
        <WizardWho
          students={students}
          lessons={[]}
          initialStudentIds={[1]}
          initialLessonUuid="l-from-url"
          initialLessonTitle="Lesson 16"
          onNext={vi.fn()}
        />,
      );

      expect(screen.getByRole('combobox', { name: /lesson/i })).toHaveValue('l-from-url');
      expect(screen.getByRole('option', { name: /Lesson 16/ })).toBeInTheDocument();
    });

    // Replaces "still lets the teacher detach it". Detaching is still possible — the
    // teacher may have arrived from the wrong lesson — but it can no longer be
    // submitted, because teacher-origin work without a lesson is refused server-side.
    it('lets the teacher detach it, but then refuses to continue', async () => {
      const onNext = vi.fn();
      render(
        <WizardWho
          students={students}
          lessons={[]}
          initialStudentIds={[1]}
          initialLessonUuid="l-from-url"
          onNext={onNext}
        />,
      );

      await userEvent.selectOptions(screen.getByRole('combobox', { name: /lesson/i }), '');

      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
      expect(onNext).not.toHaveBeenCalled();
    });
  });

  /**
   * A studentId in the URL that is not on this teacher's roster means the teacher does
   * not teach that student — the lesson belongs to a different teacher. Silently showing
   * an unfiltered picker looks like the parameter worked.
   */
  describe('a preselected student who is not on the roster', () => {
    it('says so, rather than looking like nothing was passed', () => {
      render(
        <WizardWho students={students} initialStudentIds={[9999]} onNext={vi.fn()} />,
      );

      expect(screen.getByRole('status')).toHaveTextContent(/not on your roster/i);
    });

    it('says nothing when the preselection worked', () => {
      render(
        <WizardWho students={students} initialStudentIds={[1]} onNext={vi.fn()} />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});