/**
 * Parses legacy speakasap-portal grammar exercise banks, read as plain text.
 *
 * The source files are Django/marathon-style Python: `AnswerForm` subclasses
 * whose fields are `SmartExerciseField(label='...')`. We never import or
 * execute this Python — we scan the text for the two constructs we need:
 * class headers and field assignments. Blank markup inside the extracted
 * label (`[prompt]{answer}`) is NOT parsed here — that already exists in
 * `./template` (`parseTemplate`, `DRILL_BLANK_PATTERN`) and must stay there.
 *
 * Task A.4 reuses `parseLegacyExerciseFile` unchanged for the seven other
 * banks, so keep this parser generic to "AnswerForm class + SmartExerciseField
 * label" and do not special-case grammar-bank-only file layout here.
 */

export interface LegacyExerciseItem {
  fieldName: string;
  label: string;
}

export interface LegacyExerciseClass {
  className: string;
  items: LegacyExerciseItem[];
}

const CLASS_RE = /^class\s+(\w+)\s*\(\s*AnswerForm\s*\)\s*:/gm;

// A single Python string literal, either quote style, with backslash escapes
// respected so an escaped quote doesn't terminate the literal early.
const SINGLE_QUOTED = `'(?:\\\\.|[^'\\\\])*'`;
const DOUBLE_QUOTED = `"(?:\\\\.|[^"\\\\])*"`;
const STRING_LITERAL_SRC = `(?:${SINGLE_QUOTED}|${DOUBLE_QUOTED})`;

// A field's label value may be one Python string literal, or several adjacent
// literals that Python concatenates implicitly across line-continuations,
// e.g.:
//   label='...(das '
//         'Jahrhundert)...'
// (7 real occurrences in the grammar bank.) Capture the whole run of
// literals as one blob; joinLiteralBlob() below concatenates their contents.
const FIELD_RE = new RegExp(
  `(\\bex\\d+)\\s*=\\s*SmartExerciseField\\(\\s*label\\s*=\\s*` +
    `(${STRING_LITERAL_SRC}(?:\\s*${STRING_LITERAL_SRC})*)` +
    `\\s*\\)`,
  'g',
);

const STRING_LITERAL_RE = new RegExp(STRING_LITERAL_SRC, 'g');

function unescapePythonString(raw: string): string {
  return raw.replace(/\\(['"\\])/g, '$1');
}

/** Joins one-or-more adjacent Python string literals the way Python would: direct concatenation, no separator. */
function joinLiteralBlob(blob: string): string {
  let out = '';
  for (const m of blob.matchAll(STRING_LITERAL_RE)) {
    out += unescapePythonString(m[0].slice(1, -1));
  }
  return out;
}

export function parseLegacyExerciseFile(source: string, _filename: string): LegacyExerciseClass[] {
  const boundaries: { className: string; start: number }[] = [];
  for (const m of source.matchAll(CLASS_RE)) {
    boundaries.push({ className: m[1], start: m.index! + m[0].length });
  }

  return boundaries.map((b, i) => {
    const end = i + 1 < boundaries.length ? boundaries[i + 1].start : source.length;
    const body = source.slice(b.start, end);
    const items: LegacyExerciseItem[] = [];
    for (const f of body.matchAll(FIELD_RE)) {
      items.push({ fieldName: f[1], label: joinLiteralBlob(f[2]) });
    }
    return { className: b.className, items };
  });
}

export function topicSlugFromClassName(className: string): string {
  return className
    .replace(/Ex\d+$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}
