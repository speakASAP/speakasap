import { Injectable, Logger } from '@nestjs/common';
import {
  LessonNotFoundError,
  LessonServiceUnavailableError,
  PortalLesson,
  PortalRoster,
} from './lesson-client.types';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Client for the portal's lesson API.
 *
 * The portal is the single source of truth for lessons. This service holds no lesson
 * tables; every lesson read and the two permitted lesson writes go through here.
 *
 * Deliberately NOT fail-soft. `cabinet/drills_client.py` on the portal side IS fail-soft,
 * because a drilling outage must not break an unrelated dashboard. Here the lesson IS the
 * request: a roster or a recording with no lesson behind it is meaningless, and returning
 * an empty one is what hid a frozen lesson table for six weeks. Every failure raises.
 *
 * LESSON-API: transitional — delete or repoint at legacy sunset.
 */
@Injectable()
export class LessonClientService {
  private readonly logger = new Logger(LessonClientService.name);
  private readonly baseUrl = (process.env.PORTAL_API_URL || '').replace(/\/+$/, '');
  private readonly token = process.env.PORTAL_INBOUND_API_TOKEN || '';
  private readonly timeoutMs =
    Number(process.env.PORTAL_CLIENT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  /** Indirection so tests can inject a fake without a network or a DI container. */
  private readonly fetchFn: typeof fetch = (...args) => fetch(...args);

  async getLesson(lessonUuid: string): Promise<PortalLesson> {
    const body = await this.request(
      lessonUuid,
      `/lessons/${encodeURIComponent(lessonUuid)}/`,
    );
    return this.toLesson(body);
  }

  async getRoster(lessonUuid: string): Promise<PortalRoster> {
    const body = await this.request(
      lessonUuid,
      `/lessons/${encodeURIComponent(lessonUuid)}/roster/`,
    );

    return {
      lessonUuid: String(body.lesson_uuid ?? lessonUuid),
      teacherId: this.toNullableInt(body.teacher_id),
      groups: this.toArray(body.groups).map((raw) => {
        const group = raw as Record<string, unknown>;
        return {
          uuid: String(group.uuid),
          name: String(group.name ?? ''),
          studentIds: this.toArray(group.student_ids).map(Number),
        };
      }),
      studentIds: this.toArray(body.student_ids).map(Number),
      // Absent means NO paid students. Never fall back to student_ids: that would grant
      // drilling and playback to everyone attending, paid or not.
      paidStudentIds: this.toArray(body.paid_student_ids).map(Number),
      // Absent means no names on offer — an older portal has no `students` key. The
      // caller then falls back to its own "Student <id>" rendering rather than crashing.
      names: this.toNames(body.students),
    };
  }

  /**
   * `[{id, name}]` from the portal to a Map, dropping rows that carry no usable name.
   *
   * A blank name is not stored: the caller distinguishes "auth has no name" from "the
   * portal offered one", and an empty string would satisfy the second test while
   * displaying as the first.
   */
  private toNames(raw: unknown): Map<number, string> {
    const names = new Map<number, string>();
    for (const entry of this.toArray(raw)) {
      const row = entry as Record<string, unknown>;
      const id = Number(row.id);
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (Number.isInteger(id) && id > 0 && name) {
        names.set(id, name);
      }
    }
    return names;
  }

  async updateLesson(
    lessonUuid: string,
    patch: { recommendation?: string; toManager?: string },
  ): Promise<PortalLesson> {
    const payload: Record<string, string> = {};
    if (patch.recommendation !== undefined) {
      payload.recommendation = patch.recommendation;
    }
    if (patch.toManager !== undefined) {
      payload.to_manager = patch.toManager;
    }

    const body = await this.request(
      lessonUuid,
      `/lessons/${encodeURIComponent(lessonUuid)}/`,
      'PATCH',
      payload,
    );
    return this.toLesson(body);
  }

  /**
   * Single exit point for every call, so no failure mode can skip the error handling.
   *
   * Every branch either returns a parsed body or throws. There is deliberately no path
   * that returns a default, an empty object, or null.
   */
  private async request(
    lessonUuid: string,
    path: string,
    method: 'GET' | 'PATCH' = 'GET',
    payload?: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    if (!this.baseUrl || !this.token) {
      // Misconfiguration is a failure, not a reason to degrade quietly.
      this.logger.error(
        'PORTAL_API_URL/PORTAL_INBOUND_API_TOKEN not configured; cannot reach the portal',
      );
      throw new LessonServiceUnavailableError(
        lessonUuid,
        'PORTAL_API_URL/PORTAL_INBOUND_API_TOKEN not configured',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(this.baseUrl + path, {
        method,
        headers: {
          'x-internal-token': this.token,
          'x-service-name': 'education-service',
          'content-type': 'application/json',
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Portal lesson request failed: ${method} ${path} lesson=${lessonUuid} reason=${reason}`,
      );
      throw new LessonServiceUnavailableError(lessonUuid, reason);
    } finally {
      clearTimeout(timer);
    }

    // 404 is the ONLY status that means "this lesson does not exist". Everything else
    // that is not ok — 401, 500, a proxy error page — is an outage, and must not be
    // mistaken for a definitive answer about the lesson.
    if (response.status === 404) {
      this.logger.warn(`Portal reports lesson ${lessonUuid} does not exist`);
      throw new LessonNotFoundError(lessonUuid);
    }

    if (!response.ok) {
      const text = await this.safeText(response);
      this.logger.error(
        `Portal lesson request non-ok: ${method} ${path} lesson=${lessonUuid} ` +
          `status=${response.status} body=${text.slice(0, 500)}`,
      );
      throw new LessonServiceUnavailableError(lessonUuid, `HTTP ${response.status}`);
    }

    try {
      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Portal lesson response was not JSON: lesson=${lessonUuid} reason=${reason}`,
      );
      throw new LessonServiceUnavailableError(
        lessonUuid,
        `unparseable response: ${reason}`,
      );
    }
  }

  private toLesson(body: Record<string, unknown>): PortalLesson {
    return {
      uuid: String(body.uuid),
      order: Number(body.order ?? 0),
      teacherId: this.toNullableInt(body.teacher_id),
      start: (body.start as string | null) ?? null,
      isFinished: Boolean(body.is_finished),
      studentCourseUuid: String(body.student_course_uuid),
      moduleClass: String(body.module_class ?? ''),
      courseClass: String(body.course_class ?? ''),
      needsTeacher: Boolean(body.needs_teacher),
      recommendation: String(body.recommendation ?? ''),
      toManager: String(body.to_manager ?? ''),
    };
  }

  /** Null stays null — coercing an absent teacher to 0 would match teacher id 0. */
  private toNullableInt(value: unknown): number | null {
    return value === null || value === undefined ? null : Number(value);
  }

  private toArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  /** Reading the body of an already-failed response must not mask the real error. */
  private async safeText(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return '<unreadable body>';
    }
  }
}
