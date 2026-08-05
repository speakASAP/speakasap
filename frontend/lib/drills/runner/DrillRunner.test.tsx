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

  /**
   * Checking was debounced at 250 ms, so every pause while typing counted as a wrong
   * attempt: "geg" then "gesp" then "gespro" were three failures against a student who
   * had made none. That also drove the hint escalation, which offered to reveal the
   * answer before the student had finished their first real try.
   *
   * The check now runs when the student leaves the field, or presses Enter.
   */
  it('does not check while the student is still typing', async () => {
    const spy = vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: false, acceptedText: null, attemptNo: 1,
      blanksCorrect: 0, blanksTotal: 1, assignmentCompleted: false,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('на'), 'auf');

    expect(spy).not.toHaveBeenCalled();
  });

  it('checks when the field loses focus', async () => {
    const spy = vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: true, acceptedText: 'auf', attemptNo: 1,
      blanksCorrect: 1, blanksTotal: 1, assignmentCompleted: false,
    });
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    const input = screen.getByPlaceholderText('на');
    await userEvent.type(input, 'auf');
    await userEvent.tab();

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
  });

  it('shows the server hint after a wrong answer', async () => {
    vi.spyOn(api, 'checkBlank').mockResolvedValue({
      correct: false, acceptedText: null, attemptNo: 1, hint: 'Не то. В ответе 3 буквы.',
      blanksCorrect: 0, blanksTotal: 1, assignmentCompleted: false,
    } as any);
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('на'), 'bei{Enter}');

    await waitFor(() => expect(screen.getByText(/В ответе 3 буквы/)).toBeInTheDocument());
  });

  it('clears the hint once the blank is solved', async () => {
    const spy = vi.spyOn(api, 'checkBlank')
      .mockResolvedValueOnce({
        correct: false, acceptedText: null, attemptNo: 1, hint: 'Не то. В ответе 3 буквы.',
        blanksCorrect: 0, blanksTotal: 1, assignmentCompleted: false,
      } as any)
      .mockResolvedValueOnce({
        correct: true, acceptedText: 'auf', attemptNo: 2, hint: null,
        blanksCorrect: 1, blanksTotal: 1, assignmentCompleted: false,
      } as any);
    render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

    const input = screen.getByPlaceholderText('на');
    await userEvent.type(input, 'bei{Enter}');
    await waitFor(() => expect(screen.getByText(/В ответе 3 буквы/)).toBeInTheDocument());

    await userEvent.clear(input);
    await userEvent.type(input, 'auf{Enter}');

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/В ответе 3 буквы/)).not.toBeInTheDocument();
  });

  /**
   * The third hint offers to show the answer. Until now that was only a sentence — there
   * was no button, so the runner promised something the student could not do.
   */
  describe('reveal', () => {
    const wrongThrice = {
      correct: false, acceptedText: null, attemptNo: 3,
      hint: 'Не получается? Можно показать ответ.',
      blanksCorrect: 0, blanksTotal: 1, assignmentCompleted: false,
    } as any;

    it('offers a reveal button once the server suggests it', async () => {
      vi.spyOn(api, 'checkBlank').mockResolvedValue(wrongThrice);
      render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

      await userEvent.type(screen.getByPlaceholderText('на'), 'bei{Enter}');

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /показать ответ/i })).toBeInTheDocument(),
      );
    });

    it('does not offer it before the student has struggled', async () => {
      vi.spyOn(api, 'checkBlank').mockResolvedValue({
        ...wrongThrice, attemptNo: 1, hint: 'Не то. В ответе 3 буквы.',
      });
      render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

      await userEvent.type(screen.getByPlaceholderText('на'), 'bei{Enter}');

      await waitFor(() => expect(screen.getByText(/3 буквы/)).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /показать ответ/i })).not.toBeInTheDocument();
    });

    it('shows the answer in the sentence when pressed', async () => {
      vi.spyOn(api, 'checkBlank').mockResolvedValue(wrongThrice);
      const revealSpy = vi.spyOn(api, 'revealBlank').mockResolvedValue({
        correct: false, acceptedText: 'auf', attemptNo: 4,
        blanksCorrect: 1, blanksTotal: 1, assignmentCompleted: false,
      } as any);
      render(<DrillRunner assignment={assignment} items={items as any} onComplete={vi.fn()} />);

      await userEvent.type(screen.getByPlaceholderText('на'), 'bei{Enter}');
      await waitFor(() => screen.getByRole('button', { name: /показать ответ/i }));
      await userEvent.click(screen.getByRole('button', { name: /показать ответ/i }));

      await waitFor(() => expect(revealSpy).toHaveBeenCalledWith('a-1', 'i-1', 0));
      await waitFor(() => expect(screen.getByText('auf')).toBeInTheDocument());
    });
  });
});
