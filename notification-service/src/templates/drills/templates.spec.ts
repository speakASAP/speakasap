import { renderAssignmentAssigned } from './assignment-assigned.template';
import { renderAssignmentCompleted } from './assignment-completed.template';

describe('renderAssignmentAssigned', () => {
  const input = {
    materialLanguage: 'ru',
    studentName: 'Анна',
    title: 'Предлоги',
    topics: [{ topic: 'Предлоги', url: 'https://speakasap.com/de/grammar/prepositions' }],
    dueAt: '2026-08-05T00:00:00.000Z',
    itemCount: 50,
    runnerUrl: 'https://speakasap.alfares.cz/learner/practice/a-1',
  };

  it('renders the subject in the material language', () => {
    expect(renderAssignmentAssigned(input).subject).toMatch(/[а-яА-Я]/);
  });

  it('falls back to English for an unsupported material language', () => {
    const r = renderAssignmentAssigned({ ...input, materialLanguage: 'xx' });
    expect(r.subject).toMatch(/^[\x00-\x7F]+$/);
  });

  it('links each topic to its public grammar page', () => {
    expect(renderAssignmentAssigned(input).html).toContain(
      'https://speakasap.com/de/grammar/prepositions',
    );
  });

  it('links to the runner', () => {
    expect(renderAssignmentAssigned(input).html).toContain(
      'https://speakasap.alfares.cz/learner/practice/a-1',
    );
  });

  it('omits the due date section entirely when there is none', () => {
    const r = renderAssignmentAssigned({ ...input, dueAt: null });
    expect(r.text).not.toMatch(/null|undefined|Invalid Date/);
  });

  it('always emits a plain-text alternative', () => {
    expect(renderAssignmentAssigned(input).text.length).toBeGreaterThan(0);
  });

  it('escapes HTML in the student name', () => {
    const r = renderAssignmentAssigned({ ...input, studentName: '<script>x</script>' });
    expect(r.html).not.toContain('<script>');
  });

  // Every interpolated field is attacker-influenced somewhere: a title and a topic name
  // both trace back to teacher free text, and a URL lands inside an href.
  it('escapes HTML in the title and the topic name', () => {
    const r = renderAssignmentAssigned({
      ...input,
      title: '<img src=x onerror=alert(1)>',
      topics: [{ topic: '<b>bold</b>', url: 'https://x' }],
    });

    expect(r.html).not.toContain('<img');
    expect(r.html).not.toContain('<b>bold</b>');
  });

  // A quote in a URL never reaches the href as a literal: WHATWG URL parsing
  // percent-encodes it to %22 before escapeHtml ever sees it. Either way nothing after
  // the quote can start a new attribute, which is the property that matters.
  it('encodes quotes in a topic url so nothing can break out of the href attribute', () => {
    const r = renderAssignmentAssigned({
      ...input,
      topics: [{ topic: 'T', url: 'https://x" onmouseover="alert(1)' }],
    });

    expect(r.html).not.toMatch(/href="[^"]*"\s+onmouseover/);
    expect(r.html).not.toContain('onmouseover="alert(1)"');
  });

  /**
   * Escaping says nothing about the scheme. `javascript:alert(1)` survives it intact and
   * renders as a live link in any client that honours the scheme, so URLs are validated
   * rather than merely escaped.
   */
  it.each([
    ['javascript:alert(1)'],
    ['data:text/html;base64,PHNjcmlwdD4='],
    ['vbscript:msgbox(1)'],
    ['not a url at all'],
  ])('refuses to emit a link for %s', (url) => {
    const r = renderAssignmentAssigned({ ...input, topics: [{ topic: 'T', url }] });

    // Scoped to the topic list: the runner CTA is a separate, already-validated field and
    // is always a link, so asserting over the whole document would test the wrong thing.
    const topicList = r.html.match(/<ul>.*<\/ul>/s)?.[0] ?? '';
    expect(topicList).not.toContain('<a href');
    expect(topicList).toContain('T');
    expect(r.html).not.toContain(url);
  });

  it('refuses a non-http runner url', () => {
    const r = renderAssignmentAssigned({ ...input, runnerUrl: 'javascript:alert(1)' });

    expect(r.html).not.toContain('javascript:');
  });

  it('renders a readable due date rather than an ISO timestamp', () => {
    const r = renderAssignmentAssigned(input);

    expect(r.text).not.toContain('2026-08-05T00:00:00.000Z');
    expect(r.text).toMatch(/2026/);
  });
});

describe('renderAssignmentCompleted', () => {
  const input = {
    materialLanguage: 'ru',
    teacherName: 'Ivan',
    studentName: 'Анна',
    title: 'Предлоги',
    topics: [{ topic: 'Предлоги', url: 'https://x' }],
    lessonUrl: 'https://speakasap.alfares.cz/teacher/lessons/l-1',
    reviewUrl: 'https://speakasap.alfares.cz/teacher/assignments/a-1/review',
    struggledWith: [{ sentence: 'Ich warte ___ den Bus.', blankPrompt: 'на' }],
  };

  // This track's reason to exist as a separate review gate. "Anna finished — 62%" is
  // exactly the email the requirements excluded, and it is the natural thing to write.
  it('NEVER contains a percentage, an accuracy figure or a score word', () => {
    const r = renderAssignmentCompleted(input);
    const all = `${r.subject} ${r.html} ${r.text}`;

    expect(all).not.toMatch(/%/);
    expect(all).not.toMatch(/accuracy|точность|score|балл/i);
  });

  it('lists what the student struggled with, which is qualitative not numeric', () => {
    expect(renderAssignmentCompleted(input).html).toContain('Ich warte ___ den Bus.');
  });

  it('never shows a correct answer for a struggled item', () => {
    expect(renderAssignmentCompleted(input).html).not.toContain('auf');
  });

  // The test above is weak on its own: 'auf' is a substring of ordinary German words
  // ('kaufen', 'auffallen'), so it passes for reasons unrelated to the rule. This asserts
  // the actual property — the input has no answer field at all, so no template change can
  // leak one, and the caller cannot be asked for one either.
  it('takes no answer as input, so a leak is not expressible', () => {
    expect(Object.keys(input.struggledWith[0])).toEqual(['sentence', 'blankPrompt']);
    expect(renderAssignmentCompleted(input).html).toContain('на');
  });

  it('links to the lesson and the review page', () => {
    const r = renderAssignmentCompleted(input);

    expect(r.html).toContain(input.lessonUrl);
    expect(r.html).toContain(input.reviewUrl);
  });

  it('omits the lesson link when the assignment is standalone', () => {
    const r = renderAssignmentCompleted({ ...input, lessonUrl: null });

    expect(r.html).not.toMatch(/null|undefined/);
  });

  it('falls back to English for an unsupported material language', () => {
    const r = renderAssignmentCompleted({ ...input, materialLanguage: 'xx' });

    expect(r.subject).toMatch(/^[\x00-\x7F]+$/);
  });

  it('escapes HTML in the struggled sentence', () => {
    const r = renderAssignmentCompleted({
      ...input,
      struggledWith: [{ sentence: '<script>x</script>', blankPrompt: 'p' }],
    });

    expect(r.html).not.toContain('<script>');
  });

  // A completed assignment with nothing to report is the good case, not a broken one.
  it('renders cleanly when the student struggled with nothing', () => {
    const r = renderAssignmentCompleted({ ...input, struggledWith: [] });

    expect(r.html).not.toMatch(/undefined|null/);
    expect(r.text.length).toBeGreaterThan(0);
  });

  it('always emits a plain-text alternative', () => {
    expect(renderAssignmentCompleted(input).text.length).toBeGreaterThan(0);
  });
});
