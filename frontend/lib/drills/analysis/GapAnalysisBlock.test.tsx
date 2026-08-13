import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GapAnalysisBlock } from './GapAnalysisBlock';

const mocks = vi.hoisted(() => ({
  fetchAnalysis: vi.fn(),
  retryAnalysis: vi.fn(),
  createRemedial: vi.fn(),
}));

vi.mock('@/lib/drills/analysis/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/drills/analysis/api')>(
    '@/lib/drills/analysis/api',
  );
  return { ...actual, ...mocks };
});

const readyCluster = {
  uuid: 'g1',
  topicSlug: 'en.prepositions-of-movement',
  title: 'Предлоги движения',
  explanation: 'through — движение сквозь что-то, across — поперёк.',
  rules: ['through — внутри и наружу', 'across — с одной стороны на другую'],
  examples: [{ text: 'Walk through the park.', gloss: 'Пройди через парк.' }],
  failedAnswers: [
    { answer: 'through', normalized: 'through', mistakeCount: 6, wrongAttempts: ['across'] },
  ],
  materialLanguage: 'ru',
};

function analysis(status: string, extra: Record<string, unknown> = {}) {
  return {
    uuid: 'run-1',
    sourceAssignmentUuid: 'a1',
    status,
    errorMessage: null,
    attemptCount: 1,
    clusters: [],
    ...extra,
  };
}

describe('GapAnalysisBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the explanation and rules when the analysis is ready', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    expect(await screen.findByText('Предлоги движения')).toBeInTheDocument();
    expect(screen.getByText(/через что-то|сквозь что-то/)).toBeInTheDocument();
    expect(screen.getByText('through — внутри и наружу')).toBeInTheDocument();
  });

  it('shows the example with its gloss', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    expect(await screen.findByText('Walk through the park.')).toBeInTheDocument();
    expect(screen.getByText('Пройди через парк.')).toBeInTheDocument();
  });

  it('says there were no mistakes when the run reports NO_ERRORS', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('NO_ERRORS'));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    expect(await screen.findByText(/ошибок нет/i)).toBeInTheDocument();
  });

  it('shows a visible error, NOT an empty block, when the run FAILED', async () => {
    mocks.fetchAnalysis.mockResolvedValue(
      analysis('FAILED', { errorMessage: 'upstream 502' }),
    );

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/не удался|failed/i);
    expect(screen.queryByText(/ошибок нет/i)).not.toBeInTheDocument();
  });

  it('shows a visible error when the request itself rejects', async () => {
    mocks.fetchAnalysis.mockRejectedValue(new Error('network down'));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('shows a working state while the analysis is running', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('RUNNING'));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    expect(await screen.findByText(/разбираем/i)).toBeInTheDocument();
  });

  it('offers no retry button to a student', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('FAILED', { errorMessage: 'x' }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /повторить|retry/i })).not.toBeInTheDocument();
  });

  it('offers a retry button to a teacher and calls the API', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('FAILED', { errorMessage: 'x' }));
    mocks.retryAnalysis.mockResolvedValue({ queued: true });

    render(<GapAnalysisBlock assignmentUuid="a1" audience="teacher" />);

    await userEvent.click(await screen.findByRole('button', { name: /повторить|retry/i }));

    await waitFor(() => expect(mocks.retryAnalysis).toHaveBeenCalledWith('a1'));
  });

  it('offers no remedial button to a student', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    await screen.findByText('Предлоги движения');
    expect(screen.queryByRole('button', { name: /работу над ошибками/i })).not.toBeInTheDocument();
  });

  it('shows the teacher how many sentences the drill would be before they click', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="teacher" />);

    expect(await screen.findByText(/10/)).toBeInTheDocument();
  });

  it('creates the remedial drill when the teacher clicks', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));
    mocks.createRemedial.mockResolvedValue({
      assignmentUuids: ['r1'],
      setUuid: 's1',
      reused: false,
    });

    render(<GapAnalysisBlock assignmentUuid="a1" audience="teacher" />);

    await userEvent.click(await screen.findByRole('button', { name: /работу над ошибками/i }));

    await waitFor(() => expect(mocks.createRemedial).toHaveBeenCalledWith('g1'));
  });

  it('surfaces a failed remedial creation instead of silently doing nothing', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));
    mocks.createRemedial.mockRejectedValue(new Error('Every word in this gap is already mastered'));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="teacher" />);

    await userEvent.click(await screen.findByRole('button', { name: /работу над ошибками/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/mastered/i);
  });

  it('renders nothing at all when the assignment has never been analyzed', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('NOT_ANALYZED', { uuid: null }));

    const { container } = render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    await waitFor(() => expect(mocks.fetchAnalysis).toHaveBeenCalled());
    expect(container.textContent?.trim()).toBe('');
  });

  it('lists the words the gap covers', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="teacher" />);

    // "through" also appears in the explanation, the rules and the example text for this
    // fixture, so match the failed-answers summary specifically rather than the bare word.
    expect(await screen.findByText(/through \(6\)/)).toBeInTheDocument();
  });
});
