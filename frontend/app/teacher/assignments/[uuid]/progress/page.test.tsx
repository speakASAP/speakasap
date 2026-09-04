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

const mocks = {
  fetchAnalysis: vi.fn(),
  retryAnalysis: vi.fn(),
  createRemedial: vi.fn(),
};

vi.mock('@/lib/drills/analysis/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/drills/analysis/api')>(
    '@/lib/drills/analysis/api',
  );
  return {
    ...actual,
    fetchAnalysis: (...args: unknown[]) => mocks.fetchAnalysis(...args),
    retryAnalysis: (...args: unknown[]) => mocks.retryAnalysis(...args),
    createRemedial: (...args: unknown[]) => mocks.createRemedial(...args),
  };
});

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
beforeEach(() => {
  vi.clearAllMocks();
  // GapAnalysisBlock calls fetchAnalysis on mount for every test in this file (it is
  // rendered unconditionally once `uuid` is known). NOT_ANALYZED renders nothing, so
  // pre-existing cases that never set up this mock keep seeing the page they expect.
  mocks.fetchAnalysis.mockResolvedValue({
    uuid: null,
    sourceAssignmentUuid: 'a-1',
    status: 'NOT_ANALYZED',
    errorMessage: null,
    attemptCount: 0,
    clusters: [],
  });
});

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

  /**
   * Telling the teacher to "approve it on the review screen" without saying where that
   * screen is left the page a dead end: the review route is keyed by this same assignment
   * uuid, which is in the URL bar and nowhere a teacher would think to look.
   */
  it('links to the review screen for this assignment', async () => {
    getTeacherProgress.mockResolvedValue({ ...base, status: 'PENDING_REVIEW' });

    render(<ProgressPage />);

    expect(await screen.findByRole('link', { name: /review|одобр/i })).toHaveAttribute(
      'href',
      '/teacher/assignments/a-1/review',
    );
  });

  it('offers no review link for an assigned but empty assignment', async () => {
    getTeacherProgress.mockResolvedValue({ ...base, status: 'ASSIGNED', items: [] });

    render(<ProgressPage />);

    await screen.findByRole('status');
    expect(screen.queryByRole('link', { name: /review|одобр/i })).not.toBeInTheDocument();
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

describe('teacher drill progress — a finished assignment cannot be edited', () => {
  /**
   * The reported defect: a COMPLETED assignment still rendered Edit, Delete and "Add
   * sentence", and every one of them came back "Request failed with status 409".
   *
   * The backend is right to refuse — assertEditableAssignment rejects the terminal
   * statuses because COMPLETED has no outgoing edge in the state machine, so an edit
   * would rewrite finished history while the student's recorded result still described
   * questions that no longer exist. The page was offering an action that could never
   * succeed, so the fix belongs here, not there.
   */
  it.each(['COMPLETED', 'CANCELLED'])('offers no editing controls when %s', async (status) => {
    getTeacherProgress.mockResolvedValue({ ...withSentence, status });
    render(<ProgressPage />);

    await screen.findByTestId('sentence-1');
    expect(screen.queryByRole('button', { name: /edit sentence 1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete sentence 1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add sentence/i })).not.toBeInTheDocument();
  });

  it('says why the sentences are locked, rather than just hiding the buttons', async () => {
    getTeacherProgress.mockResolvedValue({ ...withSentence, status: 'COMPLETED' });
    render(<ProgressPage />);

    expect(await screen.findByTestId('locked-note')).toHaveTextContent(/finished/i);
  });

  it('still offers the controls while the drill is live', async () => {
    getTeacherProgress.mockResolvedValue(withSentence);
    render(<ProgressPage />);

    expect(await screen.findByRole('button', { name: /edit sentence 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add sentence/i })).toBeInTheDocument();
  });
});

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

describe('progress page — gap analysis', () => {
  beforeEach(() => {
    getTeacherProgress.mockResolvedValue(base);
  });

  it('renders the analysis below the sentence list', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [
        {
          uuid: 'g1',
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'through — сквозь',
          rules: [],
          examples: [],
          failedAnswers: [
            { answer: 'through', normalized: 'through', mistakeCount: 6, wrongAttempts: [] },
          ],
          materialLanguage: 'ru',
        },
      ],
    });

    render(<ProgressPage />);

    expect(await screen.findByText('Предлоги движения')).toBeInTheDocument();
  });

  it('offers the teacher a button that says how long the drill will be', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [
        {
          uuid: 'g1',
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'x',
          rules: [],
          examples: [],
          failedAnswers: [
            { answer: 'through', normalized: 'through', mistakeCount: 12, wrongAttempts: [] },
          ],
          materialLanguage: 'ru',
        },
      ],
    });

    render(<ProgressPage />);

    const button = await screen.findByRole('button', { name: /работу над ошибками/i });
    expect(button).toHaveTextContent('12');
  });

  it('offers a retry when the analysis failed', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'FAILED',
      errorMessage: 'upstream 502',
      attemptCount: 1,
      clusters: [],
    });

    render(<ProgressPage />);

    expect(await screen.findByRole('button', { name: /повторить/i })).toBeInTheDocument();
  });

  it('confirms a created drill, including the reused case', async () => {
    const user = userEvent.setup();
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [
        {
          uuid: 'g1',
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'x',
          rules: [],
          examples: [],
          failedAnswers: [
            { answer: 'through', normalized: 'through', mistakeCount: 12, wrongAttempts: [] },
          ],
          materialLanguage: 'ru',
        },
      ],
    });
    mocks.createRemedial.mockResolvedValue({
      assignmentUuids: [],
      setUuid: 'set-1',
      reused: true,
    });

    render(<ProgressPage />);

    const button = await screen.findByRole('button', { name: /работу над ошибками/i });
    await user.click(button);

    // Twice: the banner at the top of the page, and beside the button that was clicked.
    // The button is far below the fold on a real progress page, so the inline copy is the
    // one the teacher actually sees.
    expect(
      (await screen.findAllByText(/уже создана для этого пробела/i)).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('surfaces a server refusal instead of swallowing it', async () => {
    const user = userEvent.setup();
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [
        {
          uuid: 'g1',
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'x',
          rules: [],
          examples: [],
          failedAnswers: [
            { answer: 'through', normalized: 'through', mistakeCount: 12, wrongAttempts: [] },
          ],
          materialLanguage: 'ru',
        },
      ],
    });
    mocks.createRemedial.mockRejectedValue(new Error('GAP_ALREADY_MASTERED'));

    render(<ProgressPage />);

    const button = await screen.findByRole('button', { name: /работу над ошибками/i });
    await user.click(button);

    // Both the page banner and the inline message beside the button carry the refusal.
    const alerts = await screen.findAllByRole('alert');
    alerts.forEach((alert) => expect(alert).toHaveTextContent(/GAP_ALREADY_MASTERED/));
  });

  it('clears the notice on reload so it cannot sit alongside a fresh status banner', async () => {
    // Reported risk: remove() re-fetches via load(), and nothing cleared `notice`, so a
    // teacher who creates a remedial drill and then deletes the assignment's last sentence
    // in the same session would see two role="status" live regions at once — the drill
    // notice and the "no sentences" banner that appears once items goes back to empty.
    const user = userEvent.setup();
    const oneItem = {
      ...base,
      status: 'ASSIGNED',
      items: [
        {
          uuid: 'i-1',
          order: 0,
          template: 'They are not [дома]{at home} now.',
          hint: null,
          blanks: [
            { index: 0, prompt: 'дома', answer: 'at home', solved: true, revealed: false, attemptCount: 1, wrongAttempts: [] },
          ],
        },
      ],
    };
    getTeacherProgress.mockResolvedValueOnce(oneItem);
    getTeacherProgress.mockResolvedValueOnce({ ...base, status: 'ASSIGNED', items: [] });
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [
        {
          uuid: 'g1',
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'x',
          rules: [],
          examples: [],
          failedAnswers: [
            { answer: 'through', normalized: 'through', mistakeCount: 12, wrongAttempts: [] },
          ],
          materialLanguage: 'ru',
        },
      ],
    });
    mocks.createRemedial.mockResolvedValue({
      assignmentUuids: [],
      setUuid: 'set-1',
      reused: true,
    });
    deleteAssignmentItem.mockResolvedValue({ ok: true });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ProgressPage />);

    const createButton = await screen.findByRole('button', { name: /работу над ошибками/i });
    await user.click(createButton);
    expect(
      (await screen.findAllByText(/уже создана для этого пробела/i)).length,
    ).toBeGreaterThanOrEqual(1);

    await user.click(await screen.findByRole('button', { name: /delete sentence 1/i }));

    // The "no sentences" banner replaces the item list once the reload comes back empty.
    await screen.findByText(/no sentences/i);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    confirmSpy.mockRestore();
  });

  /**
   * The page is reached by pasted link, bookmark, and the return trip from login at least
   * as often as by in-app navigation, and in all of those this app has no history entry to
   * go back to. `router.back()` therefore did nothing, leaving the only navigation control
   * on the screen dead.
   */
  it('offers Back as a real link to the assignment list, not a history step', async () => {
    getTeacherProgress.mockResolvedValue(base);
    mocks.fetchAnalysis.mockResolvedValue({ status: 'NOT_ANALYZED', clusters: [] });

    render(<ProgressPage />);

    const back = await screen.findByRole('link', { name: /back/i });
    expect(back).toHaveAttribute('href', '/teacher/assignments');
  });

  /**
   * An expired token used to render as a bare "Invalid token" box with no way forward.
   * The client redirects to login instead, and the page must stay silent while it does —
   * a red box painted over a page that is navigating away told the teacher their drill had
   * failed when only their session had.
   */
  it('renders no error when the API client is redirecting an expired session to login', async () => {
    const expired = Object.assign(new Error('Invalid token'), { redirectingToLogin: true });
    getTeacherProgress.mockRejectedValue(expired);
    mocks.fetchAnalysis.mockRejectedValue(expired);

    render(<ProgressPage />);

    await waitFor(() => {
      expect(getTeacherProgress).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Invalid token/i)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
