/**
 * Ports `user_tests.utils.process_questions` / `validate_questions` (legacy Python).
 */

export type SurveyElement = {
  type?: string;
  name?: string;
  choices?: SurveyChoice[];
  [key: string]: unknown;
};

export type SurveyChoice = {
  value?: string;
  right?: boolean;
  [key: string]: unknown;
};

export type SurveyPage = {
  elements?: SurveyElement[];
  [key: string]: unknown;
};

export type SurveyJson = {
  pages?: SurveyPage[];
  title?: string;
  [key: string]: unknown;
};

function getRightAnswers(choices: SurveyChoice[]): SurveyChoice[] {
  return choices.filter((c) => c?.right === true);
}

function isCheckbox(question: SurveyElement): boolean {
  return question?.type === 'checkbox';
}

export function processQuestions(
  data: SurveyJson,
  questionsCount: number,
  answersCount: number,
): SurveyJson {
  const pages = data.pages;
  if (!pages?.[0]?.elements) {
    throw new Error('Invalid survey JSON: missing pages[0].elements');
  }
  const allQuestions = pages[0].elements.filter((e) => isCheckbox(e));
  const picked = sampleWithoutReplacement(allQuestions, questionsCount);
  const remaining = pages[0].elements.filter((e) => !picked.includes(e));
  for (const question of picked) {
    if (!question.choices) {
      continue;
    }
    const rightAnswers = [...getRightAnswers(question.choices)];
    const wrongAnswers = question.choices.filter((c) => !c?.right);
    shuffleInPlace(rightAnswers);
    shuffleInPlace(wrongAnswers);
    const k = 1 + Math.floor(Math.random() * answersCount);
    const takeRight = rightAnswers.slice(0, Math.min(k, rightAnswers.length));
    const needWrong = answersCount - takeRight.length;
    const takeWrong = wrongAnswers.slice(0, Math.max(0, needWrong));
    const answers = [...takeRight, ...takeWrong];
    shuffleInPlace(answers);
    question.choices = answers;
  }
  pages[0].elements = [...remaining, ...picked];
  return { ...data, pages: [...pages] };
}

export function validateQuestions(data: SurveyJson, answers: Record<string, string[]>): string[] {
  const errors = new Set<string>();
  const elements = data.pages?.[0]?.elements;
  if (!elements) {
    return [];
  }
  for (const question of elements) {
    if (!isCheckbox(question) || !question.name || !question.choices) {
      continue;
    }
    const rightValues = new Set(
      getRightAnswers(question.choices)
        .map((c) => c.value)
        .filter((v): v is string => typeof v === 'string'),
    );
    const given = new Set(answers[question.name] || []);
    if (!setsEqualStrings(rightValues, given)) {
      errors.add(question.name);
    }
  }
  return [...errors];
}

function setsEqualStrings(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const x of a) {
    if (!b.has(x)) {
      return false;
    }
  }
  return true;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function sampleWithoutReplacement<T>(arr: T[], n: number): T[] {
  if (n > arr.length) {
    throw new Error('Not enough checkbox questions in asset');
  }
  const copy = [...arr];
  shuffleInPlace(copy);
  return copy.slice(0, n);
}
