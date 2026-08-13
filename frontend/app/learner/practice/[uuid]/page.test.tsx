import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import PracticeRunnerPage from './page';

const mocks = vi.hoisted(() => ({
  fetchRunner: vi.fn(),
  fetchAnalysis: vi.fn(),
  fetchGap: vi.fn(),
  useParams: vi.fn(() => ({ uuid: 'a1' })),
}));

vi.mock('next/navigation', () => ({ useParams: mocks.useParams }));
vi.mock('@/lib/drills/runner/api', () => ({ fetchRunner: mocks.fetchRunner }));
vi.mock('@/lib/drills/analysis/api', () => ({
  fetchAnalysis: mocks.fetchAnalysis,
  fetchGap: mocks.fetchGap,
  retryAnalysis: vi.fn(),
  createRemedial: vi.fn(),
  remedialSentenceCount: () => 10,
}));
vi.mock('@/lib/drills/runner/DrillRunner', () => ({
  DrillRunner: () => <div data-testid="runner" />,
}));

const runnerResponse = {
  assignment: { uuid: 'a1', title: 'Тренировка на английские предлоги', status: 'COMPLETED' },
  items: [],
};

describe('PracticeRunnerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchRunner.mockResolvedValue(runnerResponse);
    mocks.fetchGap.mockResolvedValue({
      uuid: 'g1',
      topicSlug: 'en.prepositions-of-movement',
      title: 'Предлоги движения',
      explanation: 'through — сквозь',
      rules: [],
      examples: [],
      failedAnswers: [],
      materialLanguage: 'ru',
    });
  });

  it('renders the gap analysis below the runner', async () => {
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
          failedAnswers: [],
          materialLanguage: 'ru',
        },
      ],
    });

    render(<PracticeRunnerPage />);

    expect(await screen.findByTestId('runner')).toBeInTheDocument();
    expect(await screen.findByText('Предлоги движения')).toBeInTheDocument();
  });

  it('shows the grammar for a remedial assignment ABOVE the runner', async () => {
    mocks.fetchRunner.mockResolvedValue({
      ...runnerResponse,
      assignment: {
        ...runnerResponse.assignment,
        origin: 'REMEDIAL',
        sourceAnalysisUuid: 'g1',
        title: 'Работа над ошибками: Предлоги движения',
      },
    });
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [],
    });

    const { container } = render(<PracticeRunnerPage />);

    await screen.findByTestId('runner');
    // The theory fetch only starts once `runner` carries `sourceAnalysisUuid` (a
    // render after the one that mounts the runner), so wait for it explicitly rather
    // than racing the DOM snapshot against an in-flight fetchGap.
    await screen.findByTestId('remedial-theory');

    const html = container.innerHTML;
    const theoryPosition = html.indexOf('data-testid="remedial-theory"');
    const runnerPosition = html.indexOf('data-testid="runner"');
    expect(theoryPosition).toBeGreaterThanOrEqual(0);
    expect(theoryPosition).toBeLessThan(runnerPosition);
  });

  it('shows a visible error when the analysis failed', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'FAILED',
      errorMessage: 'upstream 502',
      attemptCount: 2,
      clusters: [],
    });

    render(<PracticeRunnerPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/не удался/i);
  });

  it('offers no remedial button to the student', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [
        {
          uuid: 'g1',
          topicSlug: 'en.other',
          title: 'Прочее',
          explanation: 'x',
          rules: [],
          examples: [],
          failedAnswers: [{ answer: 'w', normalized: 'w', mistakeCount: 1, wrongAttempts: [] }],
          materialLanguage: 'ru',
        },
      ],
    });

    render(<PracticeRunnerPage />);

    await screen.findByText('Прочее');
    expect(
      screen.queryByRole('button', { name: /работу над ошибками/i }),
    ).not.toBeInTheDocument();
  });
});
