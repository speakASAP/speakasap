import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getTeacherProgress = vi.fn();

vi.mock('@/lib/drills/teacher/api', () => ({
  getTeacherProgress: (...args: unknown[]) => getTeacherProgress(...args),
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
