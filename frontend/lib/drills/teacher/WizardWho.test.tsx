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
});
