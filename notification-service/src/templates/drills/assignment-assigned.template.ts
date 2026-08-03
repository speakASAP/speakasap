import {
  Copy,
  escapeHtml,
  formatDate,
  joinSections,
  linkHtml,
  pickCopy,
  topicLinksHtml,
  topicLinksText,
} from './shared';

export interface AssignmentAssignedInput {
  materialLanguage: string;
  studentName: string;
  title: string;
  topics: { topic: string; url: string }[];
  dueAt: string | null;
  runnerUrl: string;
  itemCount: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const COPY: Copy<{
  subject: string;
  greeting: (name: string) => string;
  intro: (count: number) => string;
  topicsLabel: string;
  dueLabel: (date: string) => string;
  cta: string;
}> = {
  ru: {
    subject: 'Новое задание по грамматике',
    greeting: (name) => `Здравствуйте, ${name}!`,
    intro: (count) => `Преподаватель подготовил для вас ${count} предложений для тренировки.`,
    topicsLabel: 'Темы:',
    dueLabel: (date) => `Выполнить до: ${date}`,
    cta: 'Начать тренировку',
  },
  en: {
    subject: 'New grammar practice assigned',
    greeting: (name) => `Hello ${name},`,
    intro: (count) => `Your teacher has prepared ${count} sentences for you to practise.`,
    topicsLabel: 'Topics:',
    dueLabel: (date) => `Due: ${date}`,
    cta: 'Start practising',
  },
};

/**
 * The "there is work waiting" email.
 *
 * Deliberately carries no answers and no counts beyond how many sentences there are —
 * the student sees the drill itself in the runner, not in their inbox.
 */
export function renderAssignmentAssigned(input: AssignmentAssignedInput): RenderedEmail {
  const t = pickCopy(COPY, input.materialLanguage);
  const name = escapeHtml(input.studentName);
  const title = escapeHtml(input.title);

  // A missing due date drops the whole line rather than rendering an empty label.
  const dueDate = input.dueAt ? formatDate(input.dueAt, input.materialLanguage) : '';
  const dueLine = dueDate ? t.dueLabel(dueDate) : '';

  const html = joinSections(
    [
      `<p>${t.greeting(name)}</p>`,
      `<p>${t.intro(input.itemCount)}</p>`,
      `<p><strong>${title}</strong></p>`,
      input.topics.length > 0 ? `<p>${t.topicsLabel}</p>${topicLinksHtml(input.topics)}` : '',
      dueLine ? `<p>${escapeHtml(dueLine)}</p>` : '',
      `<p>${linkHtml(input.runnerUrl, t.cta)}</p>`,
    ],
    '\n',
  );

  const text = joinSections(
    [
      t.greeting(input.studentName),
      t.intro(input.itemCount),
      input.title,
      input.topics.length > 0 ? `${t.topicsLabel}\n${topicLinksText(input.topics)}` : '',
      dueLine,
      `${t.cta}: ${input.runnerUrl}`,
    ],
    '\n\n',
  );

  return { subject: t.subject, html, text };
}
