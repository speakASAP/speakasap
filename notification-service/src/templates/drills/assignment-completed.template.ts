import {
  Copy,
  escapeHtml,
  joinSections,
  linkHtml,
  pickCopy,
  topicLinksHtml,
  topicLinksText,
} from './shared';
import { RenderedEmail } from './assignment-assigned.template';

export interface AssignmentCompletedInput {
  materialLanguage: string;
  teacherName: string;
  studentName: string;
  title: string;
  topics: { topic: string; url: string }[];
  lessonUrl: string | null;
  reviewUrl: string;
  /**
   * What the student found hard. Qualitative by construction — there is no answer field
   * and no count, so neither can be rendered even by mistake.
   */
  struggledWith: { sentence: string; blankPrompt: string }[];
}

const COPY: Copy<{
  subject: string;
  greeting: (name: string) => string;
  intro: (student: string) => string;
  topicsLabel: string;
  struggledLabel: string;
  lessonCta: string;
  reviewCta: string;
}> = {
  ru: {
    subject: 'Ученик завершил тренировку',
    greeting: (name) => `Здравствуйте, ${name}!`,
    intro: (student) => `${student} завершил(а) тренировку по грамматике.`,
    topicsLabel: 'Темы:',
    struggledLabel: 'Труднее всего далось:',
    lessonCta: 'Открыть урок',
    reviewCta: 'Посмотреть работу',
  },
  en: {
    subject: 'Your student finished their practice',
    greeting: (name) => `Hello ${name},`,
    intro: (student) => `${student} has finished their grammar practice.`,
    topicsLabel: 'Topics:',
    struggledLabel: 'Hardest for them:',
    lessonCta: 'Open the lesson',
    reviewCta: 'See their work',
  },
};

/**
 * The "your student finished" email.
 *
 * NEVER carries a score. No percentage, no accuracy figure, no count of right answers —
 * spec §14 excludes them and "Anna finished — 62%" is the natural thing to write, which
 * is why this template exists behind its own review gate. What a teacher gets instead is
 * qualitative: the sentences the student found hard, with the blank shown as `___` and
 * the prompt beside it, never the answer.
 */
export function renderAssignmentCompleted(input: AssignmentCompletedInput): RenderedEmail {
  const t = pickCopy(COPY, input.materialLanguage);
  const teacher = escapeHtml(input.teacherName);
  const student = escapeHtml(input.studentName);
  const title = escapeHtml(input.title);

  const struggledHtml =
    input.struggledWith.length > 0
      ? `<p>${t.struggledLabel}</p><ul>${input.struggledWith
          .map(
            (s) =>
              `<li>${escapeHtml(s.sentence)} <em>(${escapeHtml(s.blankPrompt)})</em></li>`,
          )
          .join('')}</ul>`
      : '';

  const struggledText =
    input.struggledWith.length > 0
      ? `${t.struggledLabel}\n${input.struggledWith
          .map((s) => `- ${s.sentence} (${s.blankPrompt})`)
          .join('\n')}`
      : '';

  // A standalone assignment has no lesson; the link drops rather than rendering empty.
  const lessonHtml = input.lessonUrl
    ? `<p>${linkHtml(input.lessonUrl, t.lessonCta)}</p>`
    : '';
  const lessonText = input.lessonUrl ? `${t.lessonCta}: ${input.lessonUrl}` : '';

  const html = joinSections(
    [
      `<p>${t.greeting(teacher)}</p>`,
      `<p>${t.intro(student)}</p>`,
      `<p><strong>${title}</strong></p>`,
      input.topics.length > 0 ? `<p>${t.topicsLabel}</p>${topicLinksHtml(input.topics)}` : '',
      struggledHtml,
      lessonHtml,
      `<p>${linkHtml(input.reviewUrl, t.reviewCta)}</p>`,
    ],
    '\n',
  );

  const text = joinSections(
    [
      t.greeting(input.teacherName),
      t.intro(input.studentName),
      input.title,
      input.topics.length > 0 ? `${t.topicsLabel}\n${topicLinksText(input.topics)}` : '',
      struggledText,
      lessonText,
      `${t.reviewCta}: ${input.reviewUrl}`,
    ],
    '\n\n',
  );

  return { subject: t.subject, html, text };
}
