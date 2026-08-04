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
    render(<WizardWho students={students} onNext={onNext} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ studentIds: [1], lessonUuid: null });
  });

  it('assigns to several students', async () => {
    const onNext = vi.fn();
    render(<WizardWho students={students} onNext={onNext} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /boris/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ studentIds: [1, 2], lessonUuid: null });
  });

  // The group expands now rather than travelling as a reference, so a later membership
  // change cannot retroactively add or remove someone's homework.
  it('expands a group to the students in it, without duplicating an existing pick', async () => {
    const onNext = vi.fn();
    render(
      <WizardWho
        students={students}
        groups={[{ id: 'g-1', name: 'Tuesday A2', studentIds: [1, 2] }]}
        onNext={onNext}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));
    await userEvent.click(screen.getByRole('button', { name: /add tuesday a2/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ studentIds: [1, 2], lessonUuid: null });
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

  it('sends null rather than an empty string when no lesson is chosen', async () => {
    const onNext = vi.fn();
    render(
      <WizardWho
        students={students}
        lessons={[{ uuid: 'l-1', title: 'Lesson 5' }]}
        onNext={onNext}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /anna/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith({ studentIds: [1], lessonUuid: null });
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
        <WizardWho students={students} initialStudentIds={[2]} onNext={onNext} />,
      );

      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(onNext).toHaveBeenCalledWith({ studentIds: [2], lessonUuid: null });
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
        <WizardWho students={students} initialStudentIds={[1]} onNext={onNext} />,
      );

      await userEvent.click(screen.getByRole('checkbox', { name: /boris/i }));
      await userEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(onNext).toHaveBeenCalledWith({ studentIds: [1, 2], lessonUuid: null });
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
});