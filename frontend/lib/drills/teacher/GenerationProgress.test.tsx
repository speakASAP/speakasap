import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GenerationProgress as GenerationProgressDTO } from '@/lib/drills/contracts';
import * as api from './api';
import { GenerationProgress, GenerationProgressView } from './GenerationProgress';

const progress = (over: Partial<GenerationProgressDTO>): GenerationProgressDTO => ({
  phase: 'GENERATING',
  generated: 23,
  total: 50,
  etaSeconds: 34,
  message: 'Generating sentences 23 of 50',
  stalled: false,
  ...over,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('GenerationProgressView', () => {
  it('shows the phase in words, not a bare spinner', () => {
    render(<GenerationProgressView progress={progress({})} />);
    expect(screen.getByText(/generating sentences/i)).toBeInTheDocument();
  });

  // Scoped to the count element: the phase message also reads "23 of 50", so an
  // unscoped /23.*50/ matches twice and proves nothing about the counter itself.
  it('shows the running count', () => {
    render(<GenerationProgressView progress={progress({})} />);
    expect(screen.getByTestId('generation-count')).toHaveTextContent(/23.*50/);
  });

  it('counts the estimate down', () => {
    render(<GenerationProgressView progress={progress({ etaSeconds: 34 })} />);
    expect(screen.getByText(/34\s*s/i)).toBeInTheDocument();
  });

  it('says it is taking longer than expected instead of showing 0s', () => {
    render(<GenerationProgressView progress={progress({ stalled: true, etaSeconds: 0 })} />);
    expect(screen.getByText(/longer than expected/i)).toBeInTheDocument();
    expect(screen.queryByText(/^0\s*s$/)).not.toBeInTheDocument();
  });

  it('shows an error and a retry when the phase is FAILED', async () => {
    const onRetry = vi.fn();
    render(
      <GenerationProgressView
        progress={progress({ phase: 'FAILED', message: 'AI service unavailable' })}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('lists items already generated so the teacher can read before the set finishes', () => {
    render(
      <GenerationProgressView
        progress={progress({})}
        items={[
          { id: 1, template: 'Ich warte [на]{auf} den Bus.' },
          { id: 2, template: 'Ich gehe [in]{in} die Schule.' },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  // The teacher-facing screens never show a score, and progress is the easiest place for
  // "23 of 50" to be mistaken for one.
  it('shows no accuracy or percentage', () => {
    const { container } = render(<GenerationProgressView progress={progress({})} />);
    expect(container.textContent).not.toMatch(/accuracy|%/i);
  });
});

describe('GenerationProgress', () => {
  it('calls onReady once when the phase reaches READY', () => {
    const onReady = vi.fn();
    const { rerender } = render(
      <GenerationProgress progress={progress({})} onReady={onReady} />,
    );
    rerender(<GenerationProgress progress={progress({ phase: 'READY' })} onReady={onReady} />);
    rerender(<GenerationProgress progress={progress({ phase: 'READY' })} onReady={onReady} />);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('stops polling once terminal', async () => {
      const fetchSpy = vi.spyOn(api, 'getAssignment').mockResolvedValue({
        generationProgress: progress({ phase: 'READY' }),
      } as never);

      render(<GenerationProgress assignmentUuid="a-1" onReady={vi.fn()} />);
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      const callsAfterReady = fetchSpy.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2500);
      expect(fetchSpy.mock.calls.length).toBe(callsAfterReady);
    });

    it('keeps polling while the job is still running', async () => {
      const fetchSpy = vi.spyOn(api, 'getAssignment').mockResolvedValue({
        generationProgress: progress({ phase: 'GENERATING' }),
      } as never);

      render(<GenerationProgress assignmentUuid="a-1" onReady={vi.fn()} />);
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

      await vi.advanceTimersByTimeAsync(2000);
      await vi.waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(1));
    });

    it('stops polling when the job fails', async () => {
      const fetchSpy = vi.spyOn(api, 'getAssignment').mockResolvedValue({
        generationProgress: progress({ phase: 'FAILED', message: 'AI service unavailable' }),
      } as never);

      render(<GenerationProgress assignmentUuid="a-1" onReady={vi.fn()} />);
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      const calls = fetchSpy.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2500);
      expect(fetchSpy.mock.calls.length).toBe(calls);
    });

    // A poll that throws must not kill the loop: the generation is still running on the
    // server, and a teacher watching a frozen screen has no way to tell.
    it('keeps polling after a failed request', async () => {
      const fetchSpy = vi
        .spyOn(api, 'getAssignment')
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValue({ generationProgress: progress({}) } as never);

      render(<GenerationProgress assignmentUuid="a-1" onReady={vi.fn()} />);
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

      await vi.advanceTimersByTimeAsync(2000);
      await vi.waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(1));
    });

    it('does not poll at all when progress is supplied directly', async () => {
      const fetchSpy = vi.spyOn(api, 'getAssignment');
      render(<GenerationProgress progress={progress({})} onReady={vi.fn()} />);
      await vi.advanceTimersByTimeAsync(4000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
