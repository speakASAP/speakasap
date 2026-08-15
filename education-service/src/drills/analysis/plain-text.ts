/**
 * Strips LaTeX and Markdown markup out of model-written teaching text.
 *
 * The student's page renders these strings literally, so a model that reaches for LaTeX
 * puts `$\rightarrow$` on screen exactly like that — which is what a German learner saw in
 * the middle of "Мужской род (der) + ein $\rightarrow$ окончание -er".
 *
 * The prompt asks for plain text, but a prompt is a request, not a guarantee, and text
 * already stored was written before the prompt said anything. This runs on the way into
 * the database so both are covered.
 *
 * Deliberately NOT a general LaTeX renderer: it converts the handful of commands a
 * language teacher actually reaches for and otherwise unwraps the math delimiters, which
 * leaves readable text in every case rather than guessing at semantics.
 */

/** LaTeX commands worth spelling out, rather than deleting. */
const COMMANDS: Array<[RegExp, string]> = [
  [/\\(?:right|long|Right|Long)*arrow\b/g, '→'],
  [/\\to\b/g, '→'],
  [/\\leftarrow\b/g, '←'],
  [/\\leftrightarrow\b/g, '↔'],
  [/\\times\b/g, '×'],
  [/\\cdot\b/g, '·'],
  [/\\ldots\b/g, '…'],
  [/\\dots\b/g, '…'],
  [/\\neq\b/g, '≠'],
  [/\\pm\b/g, '±'],
  [/\\text\s*\{([^}]*)\}/g, '$1'],
  [/\\mathrm\s*\{([^}]*)\}/g, '$1'],
  [/\\textbf\s*\{([^}]*)\}/g, '$1'],
  [/\\textit\s*\{([^}]*)\}/g, '$1'],
  [/\\emph\s*\{([^}]*)\}/g, '$1'],
];

/**
 * One string, rendered as a human would read it.
 *
 * Returns the input unchanged when it carries no markup, so the overwhelmingly common
 * case costs one regex test and allocates nothing.
 */
export function toPlainText(value: string): string {
  if (!value || !/[$\\`*_]/.test(value)) {
    return value;
  }

  let out = value;

  // Inline and display math: unwrap the delimiters, keep the contents. Done before the
  // command table so `$\rightarrow$` becomes `→` rather than `$→$`.
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  out = out.replace(/\$([^$\n]*?)\$/g, '$1');
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, '$1');
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, '$1');

  for (const [pattern, replacement] of COMMANDS) {
    out = out.replace(pattern, replacement);
  }

  // Markdown emphasis and code fences. The bold form is handled first so `**x**` does not
  // decay into `*x*`.
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
  out = out.replace(/`([^`]+)`/g, '$1');

  // Any command left over has no display form worth inventing — drop the backslash and
  // keep the word, which reads better than a stray control sequence.
  out = out.replace(/\\([a-zA-Z]+)\b/g, '$1');
  out = out.replace(/\\([%&#_{}$])/g, '$1');

  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

/** `toPlainText` over a list, used for `rules`. */
export function toPlainTextAll(values: string[]): string[] {
  return values.map(toPlainText);
}
