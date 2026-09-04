import { getAuthSession } from '@/lib/auth-session';
import { getGatewayBaseUrl } from '@/lib/gateway';
import { redirectToLogin } from '@/lib/drills/auth-redirect';
import type {
  AssignFromSetRequest,
  AssignFromSetResponse,
  DrillAssignmentDTO,
  DrillErrorCode,
  DrillLanguageDTO,
  DrillSetDTO,
  DrillSetDetailDTO,
  DrillSetListQuery,
  DrillSetListResponse,
  DrillTeacherRosterResponse,
  InternalTeacherAssignmentsResponse,
  DrillTopicDTO,
  GenerateAssignmentsRequest,
  GenerateAssignmentsResponse,
  ValidationState,
} from '@/lib/drills/contracts';

export type {
  AssignFromSetRequest,
  AssignFromSetResponse,
  GenerateAssignmentsRequest,
  GenerateAssignmentsResponse,
};

/**
 * Teacher-facing calls for the drilling feature.
 *
 * Every response here is teacher-authenticated and may carry answers, which is exactly
 * why it is a separate module from the runner client: nothing in `lib/drills/runner`
 * should be able to reach these routes by importing a shared helper.
 */

/**
 * A failed drill call, carrying the server's typed `code` when there is one.
 *
 * The UI branches on specific codes — approve must explain that validation failures are
 * still open rather than showing a generic "request failed" — so the code has to survive
 * the boundary. A non-JSON body (a gateway 502 returns HTML) leaves `code` null rather
 * than swallowing the failure: the call still rejects.
 */
export class DrillApiError extends Error {
  readonly status: number;
  readonly code: DrillErrorCode | null;
  /**
   * True when this rejection has already been answered by sending the browser to the
   * login screen, so the caller should render nothing. Not folded into `code`: that union
   * is the set of codes education-service itself emits, and a client-only sentinel in it
   * would look like a server contract to the next reader.
   */
  readonly redirectingToLogin: boolean;

  constructor(
    status: number,
    code: DrillErrorCode | null,
    message: string,
    redirectingToLogin = false,
  ) {
    super(message);
    this.name = 'DrillApiError';
    this.status = status;
    this.code = code;
    this.redirectingToLogin = redirectingToLogin;
  }
}

export interface SetItemPatch {
  template?: string;
  hint?: string | null;
  validationState?: ValidationState;
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>;

/**
 * Builds the query string, dropping what the server should treat as "no filter".
 *
 * Empty strings and nulls are dropped; `0` and `false` are not. `lessonOrder=0` is a real
 * lesson, and a truthiness check would silently turn it into "all lessons" — a filter that
 * quietly widens is worse than one that errors.
 */
function queryString(query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== '') {
          params.append(key, entry);
        }
      }
      continue;
    }
    params.append(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function url(path: string): string {
  const base = getGatewayBaseUrl();
  if (!base) {
    throw new DrillApiError(0, null, 'NEXT_PUBLIC_API_URL is missing');
  }
  return `${base}/api/v1${path}`;
}

/**
 * Shared by every drill client module, including `lib/drills/analysis/api.ts` — this is
 * the ONE place a failed response gets turned into a `DrillApiError`. A second copy would
 * mean two places that could silently disagree about what "failed" means.
 */
export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAuthSession()?.accessToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url(path), {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });

  if (response.status === 401) {
    // The token is expired or invalid. Nothing on the page can recover from that, so the
    // user goes to the login screen and comes back to this same URL. The error still
    // throws so the caller's own flow unwinds; `isRedirectingToLogin` tells it to stay
    // quiet rather than paint a box over a page that is already navigating away.
    redirectToLogin();
    throw new DrillApiError(401, null, 'Session expired — redirecting to sign in', true);
  }

  if (!response.ok) {
    // The body is the server's typed error when the route produced it, and anything at
    // all when a proxy produced it. Both paths throw; only the detail differs.
    let code: DrillErrorCode | null = null;
    let message = `Request failed with status ${response.status}`;
    try {
      // Two shapes, both real. education-service's `HttpErrorFilter` wraps failures as
      // `{error:{code,message,details}}`; the gateway and Nest's default filter send a
      // flat `{code,message}`. Reading only the flat one discarded the message on every
      // error the service itself produced, leaving the teacher with a bare status code.
      const body = (await response.json()) as {
        code?: DrillErrorCode;
        message?: string;
        error?: { code?: DrillErrorCode; message?: string };
      };
      const envelope = body?.error ?? body;
      code = envelope?.code ?? null;
      message = envelope?.message ?? message;
    } catch {
      // Non-JSON error body; the status is all there is to report.
    }
    throw new DrillApiError(response.status, code, message);
  }

  return (await response.json()) as T;
}

export function generateAssignments(
  req: GenerateAssignmentsRequest,
): Promise<GenerateAssignmentsResponse> {
  return request('/drill-assignments/generate', { method: 'POST', body: req });
}

export function assignFromSet(req: AssignFromSetRequest): Promise<AssignFromSetResponse> {
  return request('/drill-assignments/assign', { method: 'POST', body: req });
}

export function getAssignment(uuid: string): Promise<DrillAssignmentDTO> {
  return request(`/drill-assignments/${encodeURIComponent(uuid)}`);
}

export function listSets(query: DrillSetListQuery): Promise<DrillSetListResponse> {
  return request(`/drill-sets${queryString(query as Query)}`);
}

/**
 * A set with its answers, for the review screen.
 *
 * Goes through education-service rather than content-service's own `drill-sets/:uuid`:
 * the detail route there carries answers and lives behind `internal/`, which the gateway
 * gates on a token no browser holds — calling it from here 404'd. education-service
 * checks the caller is staff first, then makes the internal hop itself.
 */
export function getSet(uuid: string): Promise<DrillSetDetailDTO> {
  return request(`/drill-assignments/teacher/sets/${encodeURIComponent(uuid)}`);
}

/**
 * Set sentence writes, routed through education-service for the same reason as `getSet`
 * and `approveSet`: content-service's item routes are internal-only, gated on a token no
 * browser holds, and that service has no auth guard of its own. These previously pointed
 * at `/drill-sets/...` directly, which 404'd — no such public route existed.
 */
export function updateSetItem(
  setUuid: string,
  itemId: number,
  patch: SetItemPatch,
): Promise<DrillSetDetailDTO> {
  return request(
    `/drill-assignments/teacher/sets/${encodeURIComponent(setUuid)}/items/${itemId}`,
    { method: 'PATCH', body: patch },
  );
}

export function deleteSetItem(setUuid: string, itemId: number): Promise<DrillSetDetailDTO> {
  return request(
    `/drill-assignments/teacher/sets/${encodeURIComponent(setUuid)}/items/${itemId}`,
    { method: 'DELETE' },
  );
}

export function createSetItem(
  setUuid: string,
  item: { template: string; hint: string | null },
): Promise<DrillSetDetailDTO> {
  return request(`/drill-assignments/teacher/sets/${encodeURIComponent(setUuid)}/items`, {
    method: 'POST',
    body: item,
  });
}

/**
 * Sentence writes on a live assignment — the student's own copy, not the set it came
 * from. A template change resets that sentence's recorded attempts server-side.
 */
export function updateAssignmentItem(
  itemUuid: string,
  patch: { template?: string; hint?: string | null },
): Promise<{ ok: true }> {
  return request(`/drill-assignments/teacher/items/${encodeURIComponent(itemUuid)}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function deleteAssignmentItem(itemUuid: string): Promise<{ ok: true }> {
  return request(`/drill-assignments/teacher/items/${encodeURIComponent(itemUuid)}`, {
    method: 'DELETE',
  });
}

export function createAssignmentItem(
  assignmentUuid: string,
  item: { template: string; hint: string | null },
): Promise<{ ok: true }> {
  return request(`/drill-assignments/teacher/${encodeURIComponent(assignmentUuid)}/items`, {
    method: 'POST',
    body: item,
  });
}

export function regenerateItems(
  setUuid: string,
  itemIds: number[],
  note?: string,
): Promise<DrillSetDetailDTO> {
  // The note is omitted rather than sent as null, so the server sees "no note" the same
  // way whether the teacher left the field blank or the caller never had one.
  const body = note === undefined ? { itemIds } : { itemIds, note };
  return request(`/drill-sets/${encodeURIComponent(setUuid)}/regenerate`, {
    method: 'POST',
    body,
  });
}

/**
 * Approve a set. Routed through education-service for the same reason as `getSet`: the
 * content-service route is internal-only, and it trusts `teacherId` from its body, which
 * must therefore be resolved server-side rather than sent from here.
 */
export function approveSet(setUuid: string): Promise<DrillSetDTO> {
  return request(`/drill-assignments/teacher/sets/${encodeURIComponent(setUuid)}/approve`, {
    method: 'POST',
  });
}

export function rateSet(setUuid: string, value: number): Promise<DrillSetDTO> {
  return request(`/drill-sets/${encodeURIComponent(setUuid)}/rate`, {
    method: 'POST',
    body: { value },
  });
}

/**
 * The teacher's own drilling summary: counts plus the sets waiting on their review.
 */
export function getTeacherSummary(): Promise<InternalTeacherAssignmentsResponse> {
  return request('/drill-assignments/teacher/summary');
}

export interface TeacherProgressBlank {
  index: number;
  prompt: string;
  answer: string;
  solved: boolean;
  revealed: boolean;
  attemptCount: number;
  wrongAttempts: string[];
}

export interface TeacherProgress {
  uuid: string;
  title: string;
  status: string;
  studentId: number;
  lessonUuid: string | null;
  items: {
    uuid: string;
    order: number;
    template: string;
    hint: string | null;
    blanks: TeacherProgressBlank[];
  }[];
}

/**
 * What the student has done with one assignment. Teacher-only, and it carries the
 * answers — seeing what was expected next to what the student typed is the point.
 */
export function getTeacherProgress(uuid: string): Promise<TeacherProgress> {
  return request(`/drill-assignments/teacher/progress/${encodeURIComponent(uuid)}`);
}

export function listTopics(
  languageCode: string,
  materialLanguage: string,
): Promise<DrillTopicDTO[]> {
  return request(`/drill-topics${queryString({ languageCode, materialLanguage })}`);
}

export function listLanguages(): Promise<DrillLanguageDTO[]> {
  return request('/drill-languages');
}

/**
 * The students this teacher may assign to, with their groups.
 *
 * Paged: a teacher with hundreds of students (656 in production) is not a dropdown.
 * `search` matches the student's name server-side, across the whole roster rather than
 * the current page. Passing no options returns the first page.
 */
export function listTeacherStudents(
  options: { search?: string; limit?: number; offset?: number; lessonUuid?: string } = {},
): Promise<DrillTeacherRosterResponse> {
  return request(
    `/drill-assignments/teacher/students${queryString({
      search: options.search,
      limit: options.limit,
      offset: options.offset,
      // Scopes the roster to one lesson's students. Needed because Lesson.teacherId is
      // the legacy Teacher profile pk while the JWT resolves to the user id, so an
      // unscoped roster matches the wrong id space for a teacher arriving from a lesson.
      lessonUuid: options.lessonUuid,
    })}`,
  );
}
