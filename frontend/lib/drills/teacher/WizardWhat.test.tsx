import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardWhat } from './WizardWhat';

afterEach(cleanup);

describe('WizardWhat', () => {
  it('requires at least one topic or non-empty instructions before continuing', async () => {
    render(<WizardWhat onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('defaults the item count to 50 and accepts 1..200', async () => {
    render(<WizardWhat onNext={vi.fn()} />);
    const input = screen.getByLabelText(/number of exercises/i);
    expect(input).toHaveValue(50);
    await userEvent.clear(input);
    await userEvent.type(input, '500');
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('enables next once instructions are typed', async () => {
    render(<WizardWhat onNext={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/instructions/i), 'focus on dative');
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('enables next once a topic is chosen, with no instructions', async () => {
    render(
      <WizardWhat
        onNext={vi.fn()}
        topics={[{ slug: 'prepositions', title: 'Предлоги', publicUrl: null } as never]}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /предлоги/i }));
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('rejects a count below 1', async () => {
    render(<WizardWhat onNext={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/instructions/i), 'x');
    const input = screen.getByLabelText(/number of exercises/i);
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('accepts the upper bound of 200', async () => {
    render(<WizardWhat onNext={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/instructions/i), 'x');
    const input = screen.getByLabelText(/number of exercises/i);
    await userEvent.clear(input);
    await userEvent.type(input, '200');
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('treats whitespace-only instructions as empty', async () => {
    render(<WizardWhat onNext={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/instructions/i), '    ');
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('hands the chosen topics, instructions and count to onNext', async () => {
    const onNext = vi.fn();
    render(
      <WizardWhat
        onNext={onNext}
        topics={[{ slug: 'prepositions', title: 'Предлоги', publicUrl: null } as never]}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /предлоги/i }));
    await userEvent.type(screen.getByLabelText(/instructions/i), 'focus on dative');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onNext).toHaveBeenCalledWith({
      topics: [expect.objectContaining({ slug: 'prepositions' })],
      instructions: 'focus on dative',
      count: 50,
    });
  });
});
