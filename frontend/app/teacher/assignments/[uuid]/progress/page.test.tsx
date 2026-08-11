import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getTeacherProgress = vi.fn();
const updateAssignmentItem = vi.fn();
const deleteAssignmentItem = vi.fn();
const createAssignmentItem = vi.fn();

vi.mock('@/lib/drills/teacher/api', () => ({
  getTeacherProgress: (...args: unknown[]) => getTeacherProgress(...args),
  updateAssignmentItem: (...args: unknown[]) => updateAssignmentItem(...args),
  deleteAssignmentItem: (...args: unknown[]) => deleteAssignmentItem(...args),
  createAssignmentItem: (...args: unknown[]) => createAssignmentItem(...args),
  DrillApiError: class extends Error {},
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ uuid: 'a-1' }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

import ProgressPage from './page';

const base = {
  uuid: 'a-1',
  title: 'Тренировка на предлоги',
  status: 'PENDING_REVIEW',
  items: [],
};

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('teacher drill progress — not yet approved', () => {
  /**
   * The reported defect: a set awaiting review has no assignment items yet — they are
   * copied from the set at approval — so the page rendered "0 / 0 Solved" over an empty
   * list. That reads as "the student did nothing", when in fact the teacher has not
   * approved the set, so the student has never been able to start.
   */
  it('explains that the set is awaiting approval instead of showing 0 / 0', async () => {
    getTeacherProgress.mockResolvedValue({ ...base, status: 'PENDING_REVIEW' });

    render(<ProgressPage />);

    expect(await screen.findByRole('status')).toHaveTextContent(/approv/i);
  });

  it('does not show the solved tiles when there is nothing to solve yet', async () => {
    getTeacherProgress.mockResolvedValue({ ...base, status: 'PENDING_REVIEW' });

    render(<ProgressPage />);

    await screen.findByRole('status');
    expect(screen.queryByText('Solved')).not.toBeInTheDocument();
  });

  it('still shows the tiles once the assignment carries items', async () => {
    getTeacherProgress.mockResolvedValue({
      ...base,
      status: 'ASSIGNED',
      items: [
        {
          uuid: 'i-1',
          blanks: [
            { index: 0, prompt: 'о', answer: 'about', solved: true, revealed: false, attemptCount: 1, wrongAttempts: [] },
          ],
        },
      ],
    });

    render(<ProgressPage />);

    await waitFor(() => {
      expect(screen.getByText('Solved')).toBeInTheDocument();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  /**
   * An ASSIGNED assignment with no items is a different thing entirely: the student has
   * work that has no content. That is a defect, not a normal state, so it must not be
   * described with the reassuring "awaiting approval" wording.
   */
  it('does not claim "awaiting approval" for an assigned but empty assignment', async () => {
    getTeacherProgress.mockResolvedValue({ ...base, status: 'ASSIGNED', items: [] });

    render(<ProgressPage />);

    const note = await screen.findByRole('status');
    expect(note).not.toHaveTextContent(/awaiting approval/i);
    expect(note).toHaveTextContent(/no sentences/i);
  });
});

const withSentence = {
  ...base,
  status: 'IN_PROGRESS',
  items: [
    {
      uuid: 'i-1',
      order: 0,
      template: 'They are not [дома]{at home}, they are [на работе]{at work} now.',
      hint: null,
      blanks: [
        { index: 0, prompt: 'дома', answer: 'at home', solved: true, revealed: false, attemptCount: 1, wrongAttempts: [] },
        { index: 1, prompt: 'на работе', answer: 'at work', solved: false, revealed: false, attemptCount: 2, wrongAttempts: ['in work'] },
      ],
    },
  ],
};

describe('teacher drill progress — the sentences themselves', () => {
  /**
   * The reported defect: the page rendered only the blank pairs ("совещания → meeting"),
   * so a teacher could not tell whether the blank tested the right thing — the sentence
   * around it was never shown, even though the API already returns the template.
   */
  it('renders the whole sentence, not only the blanks', async () => {
    getTeacherProgress.mockResolvedValue(withSentence);
    render(<ProgressPage />);

    const sentence = await screen.findByTestId('sentence-1');
    expect(sentence.textContent).toContain('They are not');
    expect(sentence.textContent).toContain('they are');
    expect(sentence.textContent).toContain('now.');
  });

  it('shows each answer with its translation after it', async () => {
    getTeacherProgress.mockResolvedValue(withSentence);
    render(<ProgressPage />);

    const sentence = await screen.findByTestId('sentence-1');
    expect(sentence.textContent).toContain('at home [дома]');
  });

  it('still shows what the student typed wrong', async () => {
    getTeacherProgress.mockResolvedValue(withSentence);
    render(<ProgressPage />);

    expect(await screen.findByText(/in work/)).toBeInTheDocument();
  });

  it('saves an edited sentence and reloads the progress', async () => {
    const user = userEvent.setup();
    getTeacherProgress.mockResolvedValue(withSentence);
    updateAssignmentItem.mockResolvedValue({ ok: true });
    render(<ProgressPage />);

    await user.click(await screen.findByRole('button', { name: /edit sentence 1/i }));
    await user.click(screen.getByRole('button', { name: /^now\.$/ }));
    await user.type(screen.getByLabelText(/translation for “now\.”/i), 'сейчас');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(updateAssignmentItem).toHaveBeenCalledWith(
        'i-1',
        expect.objectContaining({ template: expect.stringContaining('[сейчас]{now.}') }),
      );
    });
    // Reloaded rather than patched in place: the server resets attempts for the edited
    // sentence, so the counts on screen are stale until they are re-fetched.
    expect(getTeacherProgress).toHaveBeenCalledTimes(2);
  });

  it('warns that editing a sentence clears its answers', async () => {
    const user = userEvent.setup();
    getTeacherProgress.mockResolvedValue(withSentence);
    render(<ProgressPage />);

    await user.click(await screen.findByRole('button', { name: /edit sentence 1/i }));
    expect(screen.getByText(/answers .* cleared|clears .* answers/i)).toBeInTheDocument();
  });

  it('surfaces a failed save instead of pretending it worked', async () => {
    const user = userEvent.setup();
    getTeacherProgress.mockResolvedValue(withSentence);
    updateAssignmentItem.mockRejectedValue(new Error('Sentence rejected'));
    render(<ProgressPage />);

    await user.click(await screen.findByRole('button', { name: /edit sentence 1/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Sentence rejected/);
  });

  it('adds a new sentence to the assignment', async () => {
    const user = userEvent.setup();
    getTeacherProgress.mockResolvedValue(withSentence);
    createAssignmentItem.mockResolvedValue({ ok: true });
    render(<ProgressPage />);

    await user.click(await screen.findByRole('button', { name: /add sentence/i }));
    await user.type(screen.getByLabelText(/type or paste/i), 'I live outside Moscow.');
    await user.click(screen.getByRole('button', { name: /add these sentences/i }));
    await user.click(screen.getByRole('button', { name: /^outside$/ }));
    await user.type(screen.getByLabelText(/translation for “outside”/i), 'за пределами');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(createAssignmentItem).toHaveBeenCalledWith('a-1', {
        template: 'I live [за пределами]{outside} Moscow.',
        hint: null,
      });
    });
  });

  it('keeps the rest of the page usable when one sentence has no text', async () => {
    // A single malformed row used to throw out of the renderer and blank the whole
    // screen, costing the teacher every other sentence and every count.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getTeacherProgress.mockResolvedValue({
      ...withSentence,
      items: [
        { uuid: 'i-broken', order: 0, hint: null, blanks: [{ index: 0, prompt: 'о', answer: 'about', solved: false, revealed: false, attemptCount: 0, wrongAttempts: [] }] },
        withSentence.items[0],
      ],
    });

    render(<ProgressPage />);

    expect(await screen.findByText('Solved')).toBeInTheDocument();
    expect(screen.getByTestId('sentence-2').textContent).toContain('They are not');
    expect(screen.getByText(/text is missing/i)).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('confirms before deleting a sentence', async () => {
    const user = userEvent.setup();
    getTeacherProgress.mockResolvedValue(withSentence);
    deleteAssignmentItem.mockResolvedValue({ ok: true });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ProgressPage />);
    await user.click(await screen.findByRole('button', { name: /delete sentence 1/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteAssignmentItem).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('deletes once the teacher confirms', async () => {
    const user = userEvent.setup();
    getTeacherProgress.mockResolvedValue(withSentence);
    deleteAssignmentItem.mockResolvedValue({ ok: true });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ProgressPage />);
    await user.click(await screen.findByRole('button', { name: /delete sentence 1/i }));

    await waitFor(() => expect(deleteAssignmentItem).toHaveBeenCalledWith('i-1'));
    confirmSpy.mockRestore();
  });
});
