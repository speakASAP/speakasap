import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopicPicker } from './TopicPicker';

afterEach(cleanup);

describe('TopicPicker', () => {
  it('shows the public grammar URL for a mapped topic', async () => {
    render(
      <TopicPicker
        topics={[
          {
            slug: 'prepositions',
            title: 'Предлоги',
            publicUrl: 'https://speakasap.com/de/grammar/prepositions',
          } as never,
        ]}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('link', { name: /prepositions/i })).toHaveAttribute(
      'href',
      'https://speakasap.com/de/grammar/prepositions',
    );
  });

  it('shows no link for an unmapped topic rather than a broken one', () => {
    render(
      <TopicPicker
        topics={[{ slug: 'x', title: 'X', publicUrl: null } as never]}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('lets a teacher add a topic that does not exist yet, marked as new', async () => {
    const onChange = vi.fn();
    render(<TopicPicker topics={[]} selected={[]} onChange={onChange} allowCreate />);
    await userEvent.type(screen.getByRole('combobox'), 'subjunctive{Enter}');
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ slug: 'subjunctive', isNew: true }),
    ]);
  });

  it('slugifies a typed topic so the server receives a usable slug', async () => {
    const onChange = vi.fn();
    render(<TopicPicker topics={[]} selected={[]} onChange={onChange} allowCreate />);
    await userEvent.type(screen.getByRole('combobox'), 'Past Perfect Tense{Enter}');
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ slug: 'past-perfect-tense', title: 'Past Perfect Tense' }),
    ]);
  });

  it('does not create a topic when creation is not allowed', async () => {
    const onChange = vi.fn();
    render(<TopicPicker topics={[]} selected={[]} onChange={onChange} />);
    await userEvent.type(screen.getByRole('combobox'), 'subjunctive{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores an empty entry rather than creating a blank topic', async () => {
    const onChange = vi.fn();
    render(<TopicPicker topics={[]} selected={[]} onChange={onChange} allowCreate />);
    await userEvent.type(screen.getByRole('combobox'), '   {Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggles an existing topic on and off', async () => {
    const onChange = vi.fn();
    const topic = { slug: 'prepositions', title: 'Предлоги', publicUrl: null } as never;
    const { rerender } = render(
      <TopicPicker topics={[topic]} selected={[]} onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole('checkbox', { name: /предлоги/i }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ slug: 'prepositions' })]);

    onChange.mockClear();
    rerender(<TopicPicker topics={[topic]} selected={[topic]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /предлоги/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('does not add the same typed topic twice', async () => {
    const onChange = vi.fn();
    render(
      <TopicPicker
        topics={[]}
        selected={[{ slug: 'subjunctive', title: 'subjunctive', isNew: true } as never]}
        onChange={onChange}
        allowCreate
      />,
    );
    await userEvent.type(screen.getByRole('combobox'), 'subjunctive{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });
});
