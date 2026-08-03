import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryBrowser } from './LibraryBrowser';

afterEach(cleanup);

const sets = [
  { uuid: 's-1', title: 'Prepositions A2', topicSlugs: ['prepositions'], itemCount: 50 },
  { uuid: 's-2', title: 'Past tense', topicSlugs: ['past-tense'], itemCount: 30 },
  { uuid: 's-3', title: 'Loose set', topicSlugs: [], itemCount: 10 },
] as never[];

describe('LibraryBrowser', () => {
  it('groups sets by lesson by default', () => {
    render(
      <LibraryBrowser
        sets={sets}
        groups={{ 'seven:german:ru#5': ['s-1', 's-2'], unassigned: ['s-3'] }}
      />,
    );
    expect(screen.getByRole('group', { name: /lesson 5/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /unassigned/i })).toBeInTheDocument();
  });

  it('clears the lesson grouping when a search term is entered', async () => {
    const onQuery = vi.fn();
    render(<LibraryBrowser sets={sets} groups={{}} onQuery={onQuery} />);
    await userEvent.type(screen.getByRole('searchbox'), 'whale{Enter}');
    expect(onQuery).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'whale', courseKey: undefined, lessonOrder: undefined }),
    );
  });

  it('shows title, topics, item count, uses and star score — and NO accuracy', () => {
    render(
      <LibraryBrowser
        sets={[
          {
            uuid: 's-1',
            title: 'Prepositions A2',
            topicSlugs: ['prepositions'],
            itemCount: 50,
            timesAssigned: 12,
            teacherUpvotes: 3,
            studentUpvotes: 8,
            popularityScore: 23,
          } as never,
        ]}
        groups={{}}
      />,
    );
    expect(screen.getByText('Prepositions A2')).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.queryByText(/accuracy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('multi-selects sets and enables assign', async () => {
    render(<LibraryBrowser sets={sets} groups={{}} />);
    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('button', { name: /assign selected/i })).toBeEnabled();
  });

  it('disables assign until something is selected', () => {
    render(<LibraryBrowser sets={sets} groups={{}} />);
    expect(screen.getByRole('button', { name: /assign selected/i })).toBeDisabled();
  });

  it('hands every selected set uuid to onAssign', async () => {
    const onAssign = vi.fn();
    render(<LibraryBrowser sets={sets} groups={{}} onAssign={onAssign} />);
    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    await userEvent.click(screen.getAllByRole('checkbox')[2]);
    await userEvent.click(screen.getByRole('button', { name: /assign selected/i }));
    expect(onAssign).toHaveBeenCalledWith(['s-1', 's-3']);
  });

  it('renders every set once when there are no groups', () => {
    render(<LibraryBrowser sets={sets} groups={{}} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  // A group naming a set the list does not contain must not render a blank row.
  it('ignores a group entry with no matching set', () => {
    render(<LibraryBrowser sets={sets} groups={{ 'seven:german:ru#5': ['s-1', 'missing'] }} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('shows no percentage anywhere, whatever the counters say', () => {
    const { container } = render(
      <LibraryBrowser
        sets={[
          {
            uuid: 's-1',
            title: 'T',
            topicSlugs: [],
            itemCount: 10,
            timesAssigned: 100,
            popularityScore: 99,
          } as never,
        ]}
        groups={{}}
      />,
    );
    expect(container.textContent).not.toMatch(/%|accuracy|score of|correct/i);
  });
});
