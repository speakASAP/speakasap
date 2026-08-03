import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DrillRunner } from './DrillRunner';
import * as api from './api';

const items = [
  {
    uuid: 'i-1',
    order: 0,
    segments: [
      { type: 'text', value: 'Ich warte ' },
      { type: 'blank', index: 0 },
      { type: 'text', value: ' den Bus.' },
    ],
    blanks: [{ index: 0, prompt: 'на', maxLength: 9, solved: false, solvedText: null }],
    hint: '(warten auf – ждать)',
  },
];

const assignment = { uuid: 'a-1', title: 'Prepositions', blanksCorrect: 0, blanksTotal: 1 } as any;

describe('DrillRunner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a blank as an input with the prompt as placeholder', () => {
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    expect(screen.getByPlaceholderText('на')).toBeInTheDocument();
  });

  it('replaces the input with resolved text when the answer is correct', async () => {
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: true,
      acceptedText: 'auf',
      attemptNo: 1,
      blanksCorrect: 1,
      blanksTotal: 1,
      assignmentCompleted: true,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('на'), 'auf{Enter}');

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('на')).not.toBeInTheDocument();
      expect(screen.getByText('auf')).toBeInTheDocument();
    });
  });

  it('keeps the input editable and marks it wrong on an incorrect answer', async () => {
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: false,
      acceptedText: null,
      attemptNo: 1,
      blanksCorrect: 0,
      blanksTotal: 1,
      assignmentCompleted: false,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    const input = screen.getByPlaceholderText('на');
    await userEvent.type(input, 'bei{Enter}');

    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(input).toBeEnabled();
  });

  it('allows unlimited retries after a wrong answer', async () => {
    const spy = vi
      .spyOn(api, 'checkBlank')
      .mockResolvedValueOnce({
        correct: false,
        acceptedText: null,
        attemptNo: 1,
        blanksCorrect: 0,
        blanksTotal: 1,
        assignmentCompleted: false,
      })
      .mockResolvedValueOnce({
        correct: false,
        acceptedText: null,
        attemptNo: 2,
        blanksCorrect: 0,
        blanksTotal: 1,
        assignmentCompleted: false,
      })
      .mockResolvedValueOnce({
        correct: true,
        acceptedText: 'auf',
        attemptNo: 3,
        blanksCorrect: 1,
        blanksTotal: 1,
        assignmentCompleted: true,
      });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    const input = screen.getByPlaceholderText('на');
    await userEvent.type(input, 'a{Enter}');
    await userEvent.clear(input);
    await userEvent.type(input, 'b{Enter}');
    await userEvent.clear(input);
    await userEvent.type(input, 'auf{Enter}');

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(3));
  });

  it('calls onComplete exactly once, and only when the SERVER says completed', async () => {
    const onComplete = vi.fn();
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: true,
      acceptedText: 'auf',
      attemptNo: 1,
      blanksCorrect: 1,
      blanksTotal: 1,
      assignmentCompleted: false,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={onComplete} />);

    await userEvent.type(screen.getByPlaceholderText('на'), 'auf{Enter}');

    await waitFor(() => expect(screen.getByText('auf')).toBeInTheDocument());
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete once when the server does report completion', async () => {
    const onComplete = vi.fn();
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: true,
      acceptedText: 'auf',
      attemptNo: 1,
      blanksCorrect: 1,
      blanksTotal: 1,
      assignmentCompleted: true,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={onComplete} />);

    await userEvent.type(screen.getByPlaceholderText('на'), 'auf{Enter}');

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('shows "not saved" rather than marking wrong when the network fails', async () => {
    vi.spyOn(api, 'checkBlank').mockRejectedValue(
      Object.assign(new Error('offline'), { name: 'NetworkError' }),
    );
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    const input = screen.getByPlaceholderText('на');
    await userEvent.type(input, 'auf{Enter}');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/not saved/i));
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('retries once on a network failure before giving up', async () => {
    const spy = vi
      .spyOn(api, 'checkBlank')
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { name: 'NetworkError' }))
      .mockResolvedValueOnce({
        correct: true,
        acceptedText: 'auf',
        attemptNo: 1,
        blanksCorrect: 1,
        blanksTotal: 1,
        assignmentCompleted: true,
      });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('на'), 'auf{Enter}');

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('auf')).toBeInTheDocument());
  });

  it('renders an already-solved blank as text on mount', () => {
    const solved = [
      {
        ...items[0],
        blanks: [{ index: 0, prompt: 'на', maxLength: 9, solved: true, solvedText: 'auf' }],
      },
    ];
    render(<DrillRunner assignment={assignment} items={solved as any} onComplete={vi.fn()} />);

    expect(screen.queryByPlaceholderText('на')).not.toBeInTheDocument();
    expect(screen.getByText('auf')).toBeInTheDocument();
  });

  it('announces correctness politely for screen readers', async () => {
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: true,
      acceptedText: 'auf',
      attemptNo: 1,
      blanksCorrect: 1,
      blanksTotal: 1,
      assignmentCompleted: true,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('на'), 'auf{Enter}');

    await waitFor(() => expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite'));
  });

  it('shows the hint, which carries new-word translations', () => {
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    expect(screen.getByText('(warten auf – ждать)')).toBeInTheDocument();
  });

  it('renders the sentence text around the blank', () => {
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    expect(screen.getByText(/Ich warte/)).toBeInTheDocument();
    expect(screen.getByText(/den Bus\./)).toBeInTheDocument();
  });

  it('shows progress from the server counts, not from a local tally', async () => {
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: true,
      acceptedText: 'auf',
      attemptNo: 1,
      // The server is the authority: it reports 4 of 7 even though this component
      // rendered a single blank. A locally counted progress bar would say 1 of 1.
      blanksCorrect: 4,
      blanksTotal: 7,
      assignmentCompleted: false,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('на'), 'auf{Enter}');

    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4'));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '7');
  });

  it('labels every blank so it is reachable and identifiable by keyboard alone', () => {
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    expect(screen.getByLabelText(/sentence 1.*blank 1/i)).toBeInTheDocument();
  });

  it('sizes the input from maxLength, which is derived from length and never the answer', () => {
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    expect(screen.getByPlaceholderText('на')).toHaveAttribute('maxLength', '9');
  });
});
