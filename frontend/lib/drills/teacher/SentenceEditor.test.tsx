import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SentenceEditor } from './SentenceEditor';

afterEach(cleanup);

const wordButton = (text: string) => screen.getByRole('button', { name: new RegExp(`^${text}$`) });

describe('SentenceEditor — editing one sentence', () => {
  it('pre-marks the blanks of the template it was given', () => {
    render(
      <SentenceEditor
        mode="edit"
        initialTemplate="I live [за пределами]{outside} Moscow."
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(wordButton('outside')).toHaveAttribute('aria-pressed', 'true');
    expect(wordButton('live')).toHaveAttribute('aria-pressed', 'false');
  });

  it('emits the template with the blank the teacher marked', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <SentenceEditor mode="edit" initialTemplate="I live outside Moscow." onSave={onSave} onCancel={vi.fn()} />,
    );

    await user.click(wordButton('outside'));
    await user.type(screen.getByLabelText(/translation for “outside”/i), 'за пределами');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith([
      { template: 'I live [за пределами]{outside} Moscow.', hint: null },
    ]);
  });

  it('unmarks a word when it is clicked again', async () => {
    const user = userEvent.setup();
    render(
      <SentenceEditor
        mode="edit"
        initialTemplate="I live [за пределами]{outside} Moscow."
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(wordButton('outside'));
    expect(wordButton('outside')).toHaveAttribute('aria-pressed', 'false');
  });

  it('removes a blank from the drill via its Remove button, restoring the plain word', async () => {
    // A teacher who does not want a student typing "train" removes that blank; the word
    // stays in the sentence, it just stops being something to fill in.
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <SentenceEditor
        mode="edit"
        initialTemplate="The [поезд]{train} is coming [через пятнадцать минут]{in fifteen minutes}."
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /remove the blank “train”/i }));

    expect(wordButton('train')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText(/translation for “train”/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith([
      { template: 'The train is coming [через пятнадцать минут]{in fifteen minutes}.', hint: null },
    ]);
  });

  it('blocks saving a sentence with no blank, and says why', async () => {
    // The rule the teacher asked for: a sentence with nothing to fill in is not a drill.
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <SentenceEditor mode="edit" initialTemplate="I live outside Moscow." onSave={onSave} onCancel={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByText(/mark at least one word/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows the sentence as the student will see it', async () => {
    render(
      <SentenceEditor
        mode="edit"
        initialTemplate="I live [за пределами]{outside} Moscow."
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const preview = screen.getByTestId('sentence-preview');
    expect(preview.textContent).toContain('outside [за пределами]');
  });

  it('keeps an existing hint and hands it back on save', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <SentenceEditor
        mode="edit"
        initialTemplate="I live [за пределами]{outside} Moscow."
        initialHint="to live — жить"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith([
      { template: 'I live [за пределами]{outside} Moscow.', hint: 'to live — жить' },
    ]);
  });
});

describe('SentenceEditor — adding sentences', () => {
  it('turns pasted prose into one editable row per sentence', async () => {
    const user = userEvent.setup();
    render(<SentenceEditor mode="add" onSave={vi.fn()} onCancel={vi.fn()} />);

    await user.type(
      screen.getByLabelText(/type or paste/i),
      'I live outside Moscow. She can do this work without my help.',
    );
    await user.click(screen.getByRole('button', { name: /add these sentences/i }));

    expect(screen.getAllByTestId('sentence-row')).toHaveLength(2);
  });

  it('saves several sentences at once', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SentenceEditor mode="add" onSave={onSave} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/type or paste/i), 'I live outside Moscow.\nShe can help.');
    await user.click(screen.getByRole('button', { name: /add these sentences/i }));

    const rows = screen.getAllByTestId('sentence-row');
    await user.click(within(rows[0]).getByRole('button', { name: /^outside$/ }));
    await user.type(within(rows[0]).getByLabelText(/translation for “outside”/i), 'за пределами');
    await user.click(within(rows[1]).getByRole('button', { name: /^help\.$/ }));
    await user.type(within(rows[1]).getByLabelText(/translation for “help\.”/i), 'помочь');

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith([
      { template: 'I live [за пределами]{outside} Moscow.', hint: null },
      { template: 'She can [помочь]{help.}', hint: null },
    ]);
  });

  it('blocks saving while any one sentence has no blank', async () => {
    // Partial saves would leave the teacher unsure which sentences landed.
    const user = userEvent.setup();
    render(<SentenceEditor mode="add" onSave={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/type or paste/i), 'One sentence. Another sentence.');
    await user.click(screen.getByRole('button', { name: /add these sentences/i }));

    const rows = screen.getAllByTestId('sentence-row');
    await user.click(within(rows[0]).getByRole('button', { name: /^One$/ }));
    await user.type(within(rows[0]).getByLabelText(/translation for “One”/i), 'одно');

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('lets a teacher drop a sentence they do not want', async () => {
    const user = userEvent.setup();
    render(<SentenceEditor mode="add" onSave={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/type or paste/i), 'One sentence. Another sentence.');
    await user.click(screen.getByRole('button', { name: /add these sentences/i }));
    expect(screen.getAllByTestId('sentence-row')).toHaveLength(2);

    const rows = screen.getAllByTestId('sentence-row');
    await user.click(within(rows[1]).getByRole('button', { name: /remove this sentence/i }));

    expect(screen.getAllByTestId('sentence-row')).toHaveLength(1);
  });

  it('reports a save failure instead of closing as though it worked', async () => {
    // A silent failure here loses the teacher's typing.
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('Server said no'));
    render(
      <SentenceEditor mode="edit" initialTemplate="I live [за]{outside} Moscow." onSave={onSave} onCancel={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Server said no/);
  });
});
