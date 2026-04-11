/** Legacy `plural_ru` parity for question counts (Russian). */
export function formatQuestionCountRu(n: number): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) {
    return `${n} вопросов`;
  }
  if (n1 > 1 && n1 < 5) {
    return `${n} вопроса`;
  }
  if (n1 === 1) {
    return `${n} вопрос`;
  }
  return `${n} вопросов`;
}
