/**
 * The nudge a student gets after a wrong answer.
 *
 * Built on the SERVER and never from the answer itself: `CheckBlankResponse.acceptedText`
 * is contractually `null` on a wrong attempt, so computing this client-side would mean
 * shipping the answer to a student who has not solved the blank — exactly what the
 * answer-free runner payload exists to prevent.
 *
 * It escalates with the attempt number rather than helping equally every time: a student
 * one keystroke from the answer should not be handed its first letter, and a student who
 * is genuinely stuck should not be left guessing forever.
 */
const MIN_LENGTH_FOR_FIRST_LETTER = 2;

export function buildWrongAnswerHint(answer: string, attemptNo: number): string | null {
  if (typeof answer !== 'string') {
    return null;
  }
  const trimmed = answer.trim();
  if (!trimmed) {
    // No answer to derive anything from. Saying nothing beats inventing a hint.
    return null;
  }

  if (attemptNo <= 1) {
    // Letters, not characters: "sind gekommen" is 12 letters, and counting the space
    // would send the student hunting for a 13-letter word.
    const letters = trimmed.replace(/\s/g, '').length;
    return `Не то. В ответе ${letters} ${pluralLetters(letters)}.`;
  }

  if (attemptNo === MIN_LENGTH_FOR_FIRST_LETTER) {
    // A one-letter answer IS its own first letter — real here, because suffix drills use
    // single-letter blanks ("Ich heiß[]{e} Peter."). Skip straight to the reveal offer
    // rather than spelling the answer out under the guise of a hint.
    if (trimmed.replace(/\s/g, '').length > 1) {
      return `Почти. Начинается на «${trimmed.charAt(0)}».`;
    }
  }

  return 'Не получается? Можно показать ответ.';
}

function pluralLetters(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return 'буква';
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'буквы';
  }
  return 'букв';
}
