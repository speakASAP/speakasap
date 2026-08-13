/**
 * Analysis states, mirroring education-service exactly.
 *
 * `NOT_ANALYZED`, `NO_ERRORS` and `FAILED` are three different things and the UI must show
 * three different things. Collapsing any pair is how a broken analyzer starts looking like
 * a flawless drill.
 */
export type AnalysisStatus =
  | 'NOT_ANALYZED'
  | 'PENDING'
  | 'RUNNING'
  | 'READY'
  | 'NO_ERRORS'
  | 'FAILED';

export interface GapExample {
  /** In the target language. */
  text: string;
  /** In the student's material language. */
  gloss: string;
}

export interface GapFailedAnswer {
  answer: string;
  normalized: string;
  /** How many sentences this answer earns in the remedial drill. */
  mistakeCount: number;
  wrongAttempts: string[];
}

export interface GapCluster {
  uuid: string;
  topicSlug: string;
  title: string;
  explanation: string;
  rules: string[];
  examples: GapExample[];
  failedAnswers: GapFailedAnswer[];
  materialLanguage: string;
}

export interface AnalysisResponse {
  uuid: string | null;
  sourceAssignmentUuid: string;
  status: AnalysisStatus;
  errorMessage: string | null;
  attemptCount: number;
  clusters: GapCluster[];
}

export interface GapPatch {
  title?: string;
  explanation?: string;
  rules?: string[];
  examples?: GapExample[];
}

export interface RemedialCreationResult {
  assignmentUuids: string[];
  setUuid: string;
  reused: boolean;
}

/** Statuses where polling should continue. */
export const IN_FLIGHT_STATUSES: AnalysisStatus[] = ['PENDING', 'RUNNING'];

/**
 * The floor and ceiling education-service applies, restated here for the preview count.
 *
 * DUPLICATED ON PURPOSE — the frontend cannot import from education-service. They must
 * match `remedial-composition.ts`, and Step 1b's drift test is what keeps them honest.
 */
export const MIN_REMEDIAL_SENTENCES = 10;
export const MAX_REMEDIAL_SENTENCES = 20;
