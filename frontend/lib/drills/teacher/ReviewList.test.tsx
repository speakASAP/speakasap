import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewList } from './ReviewList';

afterEach(cleanup);

const items = [
  {
    id: 1,
    order: 0,
    validationState: 'PASS',
    validationIssues: [],
    item: { template: 'Ich warte [на]{auf} den Bus.', hint: null },
  },
  {
    id: 2,
    order: 1,
    validationState: 'FAIL',
    validationIssues: [{ code: 'OFF_TOPIC', message: 'Blank tests an article' }],
    item: { template: 'Ich sehe [die]{die} Schule.', hint: null },
  },
  {
    id: 3,
    order: 2,
    validationState: 'WARN',
    validationIssues: [{ code: 'WRONG_LEVEL', message: 'B1 vocabulary' }],
    item: { template: 'x [a]{b} y', hint: null },
  },
];

describe('ReviewList', () => {
  it('orders FAIL, then WARN, then PASS', () => {
    render(<ReviewList items={items as never} onApprove={vi.fn()} />);
    const headings = screen.getAllByTestId('review-item-state').map((n) => n.textContent);
    expect(headings).toEqual(['FAIL', 'WARN', 'PASS']);
  });

  it('shows the validation message next to the flagged item', () => {
    render(<ReviewList items={items as never} onApprove={vi.fn()} />);
    expect(screen.getByText('Blank tests an article')).toBeInTheDocument();
  });

  it('renders the sentence as the student will see it AND shows the answer to the teacher', () => {
    render(<ReviewList items={items as never} onApprove={vi.fn()} />);
    expect(screen.getByText(/Ich warte/)).toBeInTheDocument();
    expect(screen.getByText('auf')).toBeInTheDocument();
  });

  it('disables approve while any FAIL is unresolved', () => {
    render(<ReviewList items={items as never} onApprove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
  });

  it('enables approve once the FAIL is overridden', async () => {
    render(<ReviewList items={items as never} onApprove={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('button', { name: /keep anyway/i })[0]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled(),
    );
  });

  it('offers regenerate for a flagged item and batches the selection', async () => {
    const onRegenerate = vi.fn();
    render(
      <ReviewList items={items as never} onApprove={vi.fn()} onRegenerate={onRegenerate} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /regenerate all flagged/i }));
    expect(onRegenerate).toHaveBeenCalledWith([2, 3]);
  });

  it('shows no score anywhere', () => {
    render(<ReviewList items={items as never} onApprove={vi.fn()} />);
    expect(screen.queryByText(/accuracy|score|%/i)).not.toBeInTheDocument();
  });

  it('records an override rather than silently clearing the flag', async () => {
    const onOverride = vi.fn();
    render(
      <ReviewList items={items as never} onApprove={vi.fn()} onOverride={onOverride} />,
    );
    await userEvent.click(screen.getAllByRole('button', { name: /keep anyway/i })[0]);
    expect(onOverride).toHaveBeenCalledWith(2);
    // Asserted by content, not position: an overridden item sorts below the remaining
    // WARN, which is the point of moving it out of the teacher's way.
    const states = screen.getAllByTestId('review-item-state').map((n) => n.textContent);
    expect(states).toContain('OVERRIDDEN');
    expect(states).not.toContain('FAIL');
  });

  it('approves with no items flagged at all', async () => {
    const onApprove = vi.fn();
    render(<ReviewList items={[items[0]] as never} onApprove={onApprove} />);
    await userEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalled();
  });

  // A WARN is advisory. Blocking approve on one would make the validator's softest
  // signal as expensive as its hardest.
  it('does not block approve on a WARN alone', () => {
    render(<ReviewList items={[items[0], items[2]] as never} onApprove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled();
  });

  it('offers apply-suggestion only when the validator returned one', async () => {
    const onApplySuggestion = vi.fn();
    const withFix = [
      {
        ...items[1],
        suggestedFix: { template: 'Ich sehe [в]{in} die Schule.', blanks: [], hint: null },
      },
      items[2],
    ];
    render(
      <ReviewList
        items={withFix as never}
        onApprove={vi.fn()}
        onApplySuggestion={onApplySuggestion}
      />,
    );
    expect(screen.getAllByRole('button', { name: /apply suggestion/i })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /apply suggestion/i }));
    expect(onApplySuggestion).toHaveBeenCalledWith(2);
  });

  it('regenerates a single flagged item', async () => {
    const onRegenerate = vi.fn();
    render(
      <ReviewList items={items as never} onApprove={vi.fn()} onRegenerate={onRegenerate} />,
    );
    await userEvent.click(screen.getAllByRole('button', { name: /^regenerate$/i })[0]);
    expect(onRegenerate).toHaveBeenCalledWith([2]);
  });

  it('excludes an overridden item from the flagged regeneration batch', async () => {
    const onRegenerate = vi.fn();
    render(
      <ReviewList items={items as never} onApprove={vi.fn()} onRegenerate={onRegenerate} />,
    );
    await userEvent.click(screen.getAllByRole('button', { name: /keep anyway/i })[0]);
    await userEvent.click(screen.getByRole('button', { name: /regenerate all flagged/i }));
    expect(onRegenerate).toHaveBeenCalledWith([3]);
  });
});
