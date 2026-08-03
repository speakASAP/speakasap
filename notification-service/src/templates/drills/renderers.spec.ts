import { DRILL_RENDERERS, drillRendererFor, toAssignedInput, toCompletedInput } from './renderers';

describe('drillRendererFor', () => {
  it('resolves the two seeded drill templates', () => {
    expect(drillRendererFor('drill_assignment_assigned')).toBe(
      DRILL_RENDERERS.drill_assignment_assigned,
    );
    expect(drillRendererFor('drill_assignment_completed')).toBe(
      DRILL_RENDERERS.drill_assignment_completed,
    );
  });

  it('returns null for an unknown template so dispatch falls back to bodyHtml', () => {
    expect(drillRendererFor('some_other_email')).toBeNull();
  });

  // machineName arrives in a request body. A bare index lookup would resolve inherited
  // Object members and hand dispatch a function that is not a renderer at all.
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'does not resolve the inherited Object member %s',
    (name) => {
      expect(drillRendererFor(name)).toBeNull();
    },
  );
});

describe('toAssignedInput', () => {
  it('renders a full context end to end', () => {
    const r = DRILL_RENDERERS.drill_assignment_assigned({
      materialLanguage: 'en',
      studentName: 'Anna',
      title: 'Prepositions',
      topics: [{ topic: 'Akkusativ', url: 'https://speakasap.com/de/akkusativ' }],
      dueAt: '2026-08-10T00:00:00.000Z',
      runnerUrl: 'https://speakasap.com/learner/practice/abc',
      itemCount: 10,
    });

    expect(r.subject).toBe('New grammar practice assigned');
    expect(r.html).toContain('Anna');
    expect(r.html).toContain('Prepositions');
    // The array field the placeholder renderer could never have produced.
    expect(r.html).toContain('https://speakasap.com/de/akkusativ');
    expect(r.html).toContain('Akkusativ');
    expect(r.html).toContain('10 sentences');
  });

  it('drops malformed topic entries rather than rendering undefined', () => {
    const input = toAssignedInput({
      topics: [
        { topic: 'ok', url: 'https://example.com' },
        { topic: 'no url' },
        null,
        'not an object',
        { url: 'https://example.com/no-topic' },
      ],
    });
    expect(input.topics).toEqual([{ topic: 'ok', url: 'https://example.com' }]);
  });

  it('coerces a missing context to a renderable input', () => {
    const input = toAssignedInput({});
    expect(input).toEqual({
      materialLanguage: 'en',
      studentName: '',
      title: '',
      topics: [],
      dueAt: null,
      runnerUrl: '',
      itemCount: 0,
    });
    expect(() => DRILL_RENDERERS.drill_assignment_assigned({})).not.toThrow();
  });

  it('honours the recipient material language', () => {
    expect(DRILL_RENDERERS.drill_assignment_assigned({ materialLanguage: 'ru' }).subject).toMatch(
      /[а-яА-Я]/,
    );
  });

  it('treats a non-numeric itemCount as zero rather than propagating NaN', () => {
    expect(toAssignedInput({ itemCount: 'ten' }).itemCount).toBe(0);
    expect(toAssignedInput({ itemCount: Number.NaN }).itemCount).toBe(0);
  });
});

describe('toCompletedInput', () => {
  it('renders the struggled list, with the blank as ___ and never the answer', () => {
    const r = DRILL_RENDERERS.drill_assignment_completed({
      materialLanguage: 'en',
      teacherName: 'Elena',
      studentName: 'Anna',
      title: 'Prepositions',
      topics: [],
      lessonUrl: null,
      reviewUrl: 'https://speakasap.com/teacher/assignments/abc',
      struggledWith: [{ sentence: 'Ich warte ___ den Bus.', blankPrompt: 'warten' }],
    });

    expect(r.html).toContain('Ich warte ___ den Bus.');
    expect(r.html).toContain('warten');
    expect(r.html).not.toContain('auf');
  });

  it('carries no score, percentage or count of correct answers', () => {
    const r = DRILL_RENDERERS.drill_assignment_completed({
      teacherName: 'Elena',
      studentName: 'Anna',
      title: 'Prepositions',
      // Fields a future caller might wrongly add to the context bag. The renderer's input
      // type has nowhere to put them, so they cannot reach the email.
      blanksCorrect: 7,
      blanksTotal: 10,
      accuracy: 70,
      score: '70%',
    } as Record<string, unknown>);

    expect(r.html).not.toMatch(/%/);
    expect(r.html).not.toContain('70');
    expect(r.text).not.toContain('70');
  });

  it('drops a lesson link that is absent rather than rendering an empty anchor', () => {
    const r = DRILL_RENDERERS.drill_assignment_completed({
      teacherName: 'Elena',
      studentName: 'Anna',
      title: 'T',
      reviewUrl: 'https://speakasap.com/teacher/assignments/abc',
    });
    expect(r.html).not.toContain('Open the lesson');
  });

  it('coerces malformed struggled entries instead of throwing', () => {
    expect(toCompletedInput({ struggledWith: [null, 'x', { sentence: 'a' }] }).struggledWith).toEqual(
      [{ sentence: 'a', blankPrompt: '' }],
    );
  });
});
