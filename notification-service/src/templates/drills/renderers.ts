import {
  renderAssignmentAssigned,
  type AssignmentAssignedInput,
  type RenderedEmail,
} from './assignment-assigned.template';
import {
  renderAssignmentCompleted,
  type AssignmentCompletedInput,
} from './assignment-completed.template';

/**
 * Code-side renderers for the two drill emails.
 *
 * The generic dispatch path renders a template row's `bodyHtml` with
 * `renderTemplateHtml`, which substitutes `{{key}}` and returns an empty string for any
 * value that is not a scalar. Both drill emails carry arrays — the topic list, and the
 * sentences a student struggled with — so a seeded `bodyHtml` could never render them:
 * the rows would silently email a body with the interesting parts missing.
 *
 * Rather than grow the placeholder renderer into a template language (which would change
 * behaviour for every other template that shares it), a dispatch for one of these two
 * machine names is rendered here instead. The seeded rows still exist and still carry the
 * title, visibility and preference wiring the rest of dispatch depends on; only the body
 * comes from code.
 */
export type DrillRenderer = (context: Record<string, unknown>) => RenderedEmail;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function int(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * The context bag arrives as JSON over HTTP, so nothing about its shape is guaranteed.
 * Every field is coerced rather than trusted: a malformed topic entry drops out of the
 * list instead of rendering `undefined` into an email that has already been sent.
 */
function topicsOf(value: unknown): { topic: string; url: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (t): t is { topic: string; url: string } =>
        Boolean(t) &&
        typeof (t as { topic?: unknown }).topic === 'string' &&
        typeof (t as { url?: unknown }).url === 'string',
    )
    .map((t) => ({ topic: t.topic, url: t.url }));
}

function struggledOf(value: unknown): { sentence: string; blankPrompt: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .map((s) => ({
      sentence: str(s.sentence),
      blankPrompt: str(s.blankPrompt),
    }));
}

export function toAssignedInput(context: Record<string, unknown>): AssignmentAssignedInput {
  return {
    materialLanguage: str(context.materialLanguage, 'en'),
    studentName: str(context.studentName),
    title: str(context.title),
    topics: topicsOf(context.topics),
    dueAt: nullableStr(context.dueAt),
    runnerUrl: str(context.runnerUrl),
    itemCount: int(context.itemCount),
  };
}

export function toCompletedInput(context: Record<string, unknown>): AssignmentCompletedInput {
  return {
    materialLanguage: str(context.materialLanguage, 'en'),
    teacherName: str(context.teacherName),
    studentName: str(context.studentName),
    title: str(context.title),
    topics: topicsOf(context.topics),
    lessonUrl: nullableStr(context.lessonUrl),
    reviewUrl: str(context.reviewUrl),
    struggledWith: struggledOf(context.struggledWith),
  };
}

export const DRILL_RENDERERS: Record<string, DrillRenderer> = {
  drill_assignment_assigned: (context) => renderAssignmentAssigned(toAssignedInput(context)),
  drill_assignment_completed: (context) => renderAssignmentCompleted(toCompletedInput(context)),
};

export function drillRendererFor(machineName: string): DrillRenderer | null {
  return Object.prototype.hasOwnProperty.call(DRILL_RENDERERS, machineName)
    ? DRILL_RENDERERS[machineName]
    : null;
}
