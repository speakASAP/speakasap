/** One blank the student got wrong, with everything the analyzer needs to explain it. */
export interface FailedBlank {
  itemUuid: string;
  blankIndex: number;
  /** The correct answer, in its surface form. */
  answer: string;
  /** The blank's prompt, e.g. "через". Null when the item carries none. */
  prompt: string | null;
  /** The item template, blank placeholder included. */
  sentence: string;
  /** What the student typed, wrong and non-revealed, in the order they tried. */
  wrongAttempts: string[];
  /** Whether the student gave up and revealed this blank. */
  revealed: boolean;
  /**
   * How many times the student got this blank wrong — the number of remedial sentences
   * this answer earns. A blank revealed with nothing typed still counts as one: the
   * student did not know it.
   */
  mistakeCount: number;
}

/** The item shape the analysis reads. Matches `DrillAssignmentItem` rows. */
export interface AnalysisItemInput {
  uuid: string;
  order: number;
  template: string;
  /** Prisma `Json`; validated at the boundary rather than trusted. */
  blanks: unknown;
}

/** The attempt shape the analysis reads. Matches `DrillAttempt` rows. */
export interface AnalysisAttemptInput {
  itemUuid: string;
  blankIndex: number;
  submittedValue: string;
  isCorrect: boolean;
  revealed: boolean;
  attemptNo: number;
}
