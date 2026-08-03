import { getAuthSession } from '@/lib/auth-session';
import { getGatewayBaseUrl } from '@/lib/gateway';
import type {
  CheckBlankRequest,
  CheckBlankResponse,
  DrillAssignmentDTO,
  DrillErrorCode,
  InternalStudentAssignmentsResponse,
  RunnerResponse,
} from '@/lib/drills/contracts';

/**
 * Student-facing calls for the drilling runner.
 *
 * Deliberately separate from `lib/drills/teacher/api.ts`: those routes are
 * teacher-authenticated and may carry answers, and nothing reachable from the runner
 * should be able to call them by importing a shared helper.
 */

/**
 * A failed drill call that reached the server and got an answer back.
 *
 * Carries the server's typed `code` so the UI can branch — a self-drill blocked by
 * `ASSIGNMENT_OUTSTANDING` needs to name the blocking assignment, not say "request
 * failed". A non-JSON body (a gateway 502 returns HTML) leaves `code` null rather than
 * swallowing the failure: the call still rejects.
 */
export class DrillRunnerError extends Error {
  readonly status: number;
  readonly code: DrillErrorCode | null;
  readonly blockingAssignmentUuid: string | null;

  constructor(
    status: number,
    code: DrillErrorCode | null,
    message: string,
    blockingAssignmentUuid: string | null = null,
  ) {
    super(message);
    this.name = 'DrillRunnerError';
    this.status = status;
    this.code = code;
    this.blockingAssignmentUuid = blockingAssignmentUuid;
  }
}

/**
 * The request never reached the server, so nothing was recorded.
 *
 * This is a distinct type because the student-facing consequence is different: a wrong
 * answer is the student's problem, but a transport failure is ours, and showing "wrong"
 * for a dropped connection teaches the student the wrong thing. The runner uses this
 * distinction to say "not saved" instead of marking the blank incorrect.
 */
export class NetworkError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Builds the gateway path.
 *
 * An absent `NEXT_PUBLIC_API_URL` yields a relative URL rather than an error: the runner
 * is served by the same origin as the gateway in production, so same-origin is the
 * correct default, and failing here would break the page over configuration that is
 * legitimately optional.
 */
function url(path: string): string {
  return `${getGatewayBaseUrl() ?? ''}/api/v1${path}`;
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAuthSession()?.accessToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url(path), {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
  } catch (cause) {
    // The request never left, or no reply came back. Nothing was recorded server-side.
    throw new NetworkError(cause instanceof Error ? cause.message : 'network request failed', cause);
  }

  if (!response.ok) {
    let code: DrillErrorCode | null = null;
    let message = `Request failed with status ${response.status}`;
    let blockingAssignmentUuid: string | null = null;
    try {
      const body = (await response.json()) as {
        code?: DrillErrorCode;
        message?: string;
        blockingAssignmentUuid?: string;
      };
      code = body?.code ?? null;
      message = body?.message ?? message;
      blockingAssignmentUuid = body?.blockingAssignmentUuid ?? null;
    } catch {
      // Non-JSON error body; the status is all there is to report.
    }
    throw new DrillRunnerError(response.status, code, message, blockingAssignmentUuid);
  }

  return (await response.json()) as T;
}

function assignmentPath(uuid: string, suffix = ''): string {
  return `/drill-assignments/${encodeURIComponent(uuid)}${suffix}`;
}

/** The answer-free item payload for one assignment. */
export function fetchRunner(uuid: string): Promise<RunnerResponse> {
  return request(assignmentPath(uuid, '/runner'));
}

/** Grades one blank. The server decides correctness and completion; the client never does. */
export function checkBlank(uuid: string, req: CheckBlankRequest): Promise<CheckBlankResponse> {
  return request(assignmentPath(uuid, '/check'), { method: 'POST', body: req });
}

export function revealBlank(
  uuid: string,
  itemUuid: string,
  blankIndex: number,
): Promise<CheckBlankResponse> {
  return request(assignmentPath(uuid, '/reveal'), {
    method: 'POST',
    body: { itemUuid, blankIndex },
  });
}

export function rateAssignment(uuid: string, value: number): Promise<void> {
  return request(assignmentPath(uuid, '/rate'), { method: 'POST', body: { value } });
}

export function listMyAssignments(): Promise<InternalStudentAssignmentsResponse> {
  return request('/drill-assignments');
}

export function startSelfDrill(setUuid: string): Promise<DrillAssignmentDTO> {
  return request('/drill-assignments/self', { method: 'POST', body: { setUuid } });
}
