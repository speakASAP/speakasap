import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import NewAssignmentPage from './page';

const listTeacherStudents = vi.fn();
const listTopics = vi.fn();

vi.mock('@/lib/drills/teacher/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/drills/teacher/api')>(
    '@/lib/drills/teacher/api',
  );
  return {
    ...actual,
    listTeacherStudents: (...args: unknown[]) => listTeacherStudents(...args),
    listTopics: (...args: unknown[]) => listTopics(...args),
    generateAssignments: vi.fn(),
  };
});

const searchParams = new URLSearchParams({
  lessonUuid: 'f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477',
  studentId: '215116',
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

const emptyRoster = { students: [], groups: [], total: 0, hasMore: false };

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  listTopics.mockResolvedValue([]);
});

describe('NewAssignmentPage roster states', () => {
  /**
   * The regression this file exists for: a lesson whose roster resolves to zero students
   * is a *finished* load, not a pending one. Rendering the loading skeleton for it leaves
   * the teacher on a page of grey bars that never resolve, with nothing to act on.
   */
  it('explains an empty roster instead of showing skeletons forever', async () => {
    listTeacherStudents.mockResolvedValue(emptyRoster);

    render(<NewAssignmentPage />);

    await waitFor(() => {
      expect(screen.queryByLabelText('Loading your students')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent(/no students/i);
  });

  it('shows the skeleton while the roster is still in flight', async () => {
    listTeacherStudents.mockReturnValue(new Promise(() => {}));

    render(<NewAssignmentPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Loading your students')).toBeInTheDocument();
    });
  });

  it('renders the picker once students arrive', async () => {
    listTeacherStudents.mockResolvedValue({
      ...emptyRoster,
      students: [{ id: 215116, name: 'Anna' }],
      total: 1,
    });

    render(<NewAssignmentPage />);

    expect(await screen.findByRole('checkbox', { name: /anna/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading your students')).not.toBeInTheDocument();
  });

  it('still surfaces a failed roster as an error', async () => {
    listTeacherStudents.mockRejectedValue(new Error('boom'));

    render(<NewAssignmentPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your students/i);
    expect(screen.queryByLabelText('Loading your students')).not.toBeInTheDocument();
  });
});

/**
 * The course's language decides which topics are offered and, more importantly, which
 * language the generated drills are in.
 *
 * The wizard hardcoded ('de', 'ru'), so an English course listed German topics
 * (`adjektivgruppen`, `nullartikel`) and generation would have produced German drills
 * for a student learning English.
 */
describe('NewAssignmentPage course language', () => {
  it('asks for the course language the lesson reports, not German', async () => {
    listTeacherStudents.mockResolvedValue({
      ...emptyRoster,
      students: [{ id: 314082, name: 'Tetiana Kovach' }],
      total: 1,
      languageCode: 'en',
      materialLanguage: 'ru',
    });

    render(<NewAssignmentPage />);

    await waitFor(() => {
      expect(listTopics).toHaveBeenCalledWith('en', 'ru');
    });
    expect(listTopics).not.toHaveBeenCalledWith('de', 'ru');
  });

  it('asks for German only when the course is actually German', async () => {
    listTeacherStudents.mockResolvedValue({
      ...emptyRoster,
      languageCode: 'de',
      materialLanguage: 'ru',
    });

    render(<NewAssignmentPage />);

    await waitFor(() => {
      expect(listTopics).toHaveBeenCalledWith('de', 'ru');
    });
  });

  it('fetches no topics at all when the lesson names no language', async () => {
    // Better an empty picker the teacher types into than another language's grammar.
    listTeacherStudents.mockResolvedValue({
      ...emptyRoster,
      languageCode: null,
      materialLanguage: null,
    });

    render(<NewAssignmentPage />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
    expect(listTopics).not.toHaveBeenCalled();
  });
});
