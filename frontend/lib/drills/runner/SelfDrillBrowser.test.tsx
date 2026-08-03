import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SelfDrillBrowser } from './SelfDrillBrowser';
import * as api from './api';

const sets = [{ uuid: 's-1', title: 'Past tense', itemCount: 20 }];

describe('SelfDrillBrowser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a lock message and no set list while an assignment is outstanding', () => {
    render(<SelfDrillBrowser allowed={false} blockingTitle="Prepositions" sets={[]} />);

    expect(screen.getByText(/finish.*Prepositions/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('lists approved sets when nothing is outstanding', () => {
    render(<SelfDrillBrowser allowed={true} blockingTitle={null} sets={sets as any} />);

    expect(screen.getByText('Past tense')).toBeInTheDocument();
  });

  it('surfaces a server 409 if it happens anyway, without breaking the page', async () => {
    vi.spyOn(api, 'startSelfDrill').mockRejectedValue({ code: 'ASSIGNMENT_OUTSTANDING' });
    render(<SelfDrillBrowser allowed={true} blockingTitle={null} sets={sets as any} />);

    await userEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // The page survives: the set is still listed and still startable.
    expect(screen.getByText('Past tense')).toBeInTheDocument();
  });

  it('starts the drill for the set the student picked', async () => {
    const spy = vi.spyOn(api, 'startSelfDrill').mockResolvedValue({ uuid: 'a-9' } as any);
    const onStarted = vi.fn();
    render(
      <SelfDrillBrowser allowed={true} blockingTitle={null} sets={sets as any} onStarted={onStarted} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith('s-1'));
    expect(onStarted).toHaveBeenCalledWith('a-9');
  });

  it('does not start a second drill while one is already starting', async () => {
    const spy = vi
      .spyOn(api, 'startSelfDrill')
      .mockImplementation(() => new Promise(() => {}) as Promise<any>);
    render(<SelfDrillBrowser allowed={true} blockingTitle={null} sets={sets as any} />);

    const button = screen.getByRole('button', { name: /start/i });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('tells the student when there is nothing available to drill', () => {
    render(<SelfDrillBrowser allowed={true} blockingTitle={null} sets={[]} />);

    expect(screen.getByText(/nothing.*available|no sets/i)).toBeInTheDocument();
  });
});
