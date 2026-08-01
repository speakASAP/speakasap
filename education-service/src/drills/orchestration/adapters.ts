import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerationProgress, ResolveLegacyUserResponse } from '../contracts';
import { ContentClient } from './content.client';
import { GenerationJobRepository } from './job-runner.service';
import { numericEnv, requestUpstream, requiredEnv } from './http';

/**
 * Track D's implementations of the boundaries Track B2 left unbound.
 *
 * B2 declared them as interfaces and deliberately did not provide them, so the module
 * fails at startup rather than running against a stub (B2 handoff, "Will not boot yet").
 * These are those implementations.
 */

/**
 * `DrillSetsClient` for SelfDrillService.
 *
 * NOTE: `incrementSelfSelected` has no route in content-service — Track A2 shipped
 * `POST drill-sets/:uuid/ratings` but nothing that bumps `timesSelfSelected`. It is
 * logged and skipped rather than throwing: failing a student's drill start because a
 * popularity counter could not be bumped would be the wrong trade. The counter feeds
 * library ranking only.
 */
@Injectable()
export class DrillSetsClientAdapter {
  private readonly logger = new Logger(DrillSetsClientAdapter.name);

  constructor(private readonly content: ContentClient) {}

  async getSet(setUuid: string): Promise<any> {
    return this.content.getSet(setUuid, this.internalCallerToken());
  }

  async incrementSelfSelected(setUuid: string): Promise<void> {
    this.logger.warn(
      `timesSelfSelected not incremented for set ${setUuid}: content-service exposes no route for it (Track D handoff)`,
    );
  }

  /**
   * Service-to-service calls carry the service's own token, not a student's: a student
   * must never hold a credential that reaches an `internal/` route, because those
   * routes return answers.
   */
  private internalCallerToken(): string {
    return requiredEnv('INTERNAL_API_TOKEN', 'content-service');
  }
}

/**
 * `StudentProgressClient` — where the student currently is in their course.
 *
 * Read from this service's own tables rather than over HTTP: the data is already here,
 * and a network hop to fetch a local row is a failure mode for nothing.
 *
 * The join is not direct. `StudentCourse` carries no `studentId` — a student reaches a
 * course through `GroupStudent -> Group -> StudentCourse` (the legacy Django shape).
 * `courseKey` is `StudentCourse.courseClass`, and the lesson ceiling is the highest
 * `Lesson.order` the student has finished, not a stored counter.
 */
@Injectable()
export class StudentProgressClientAdapter {
  private readonly logger = new Logger(StudentProgressClientAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStudentProgress(
    studentId: number,
  ): Promise<{ courseKey: string | null; lessonOrder: number | null }> {
    const course = await (this.prisma as any).studentCourse.findFirst({
      where: {
        isFinished: false,
        group: { groupStudents: { some: { studentId } } },
      },
      orderBy: { createdAt: 'desc' },
      select: { uuid: true, courseClass: true },
    });

    if (!course) {
      // Not an error: a student with no active course simply has no ceiling. The caller
      // decides what that means — this must not guess a lesson order, because guessing
      // high shows the student material they have not reached.
      this.logger.warn(`No active StudentCourse for student ${studentId}; progress unknown`);
      return { courseKey: null, lessonOrder: null };
    }

    const furthest = await (this.prisma as any).lesson.findFirst({
      where: { studentCourseUuid: course.uuid, isFinished: true },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return {
      courseKey: course.courseClass ?? null,
      lessonOrder: furthest?.order ?? null,
    };
  }
}

/**
 * `DrillIdentityResolver` — the auth UUID to legacy integer bridge.
 *
 * BLOCKED ON AUTH-MICROSERVICE. Track H shipped two routes and both map in the wrong
 * direction: `GET /internal/users/by-legacy-id` and
 * `POST /internal/users/resolve-or-provision-legacy` both take a legacy id and return
 * an auth UUID (contract C9). This resolver needs the reverse — auth UUID to legacy id
 * — because the JWT carries the UUID while `DrillAssignment.studentId` is the legacy
 * Django integer. No route returns that.
 *
 * It fails CLOSED (503 IDENTITY_UNRESOLVED, contract C7) rather than guessing. Guessing
 * a student id would hand one student another student's assignments and their answers;
 * a 503 only means the endpoint is unavailable, which is the truth.
 *
 * Resolve by adding a lookup keyed on authUserId to auth-microservice's
 * InternalUsersController, then replacing the throw below with the call.
 */
@Injectable()
export class DrillIdentityResolverAdapter {
  private readonly logger = new Logger(DrillIdentityResolverAdapter.name);

  async resolveStudentId(authUserId: string): Promise<number> {
    this.logger.error(
      `Cannot resolve auth user ${authUserId} to a legacy student id: auth-microservice exposes no authUserId -> legacyUserId route (Track D handoff)`,
    );
    throw new ServiceUnavailableException({
      statusCode: 503,
      code: 'IDENTITY_UNRESOLVED',
      message: 'Could not resolve the signed-in user to a student record',
    });
  }
}

/**
 * `GenerationJobRepository` for JobRunner.
 *
 * AssignmentsRepository is Track B's file and carries none of these methods; Track D
 * does not edit it, so the three writes live here against the same Prisma client.
 */
@Injectable()
export class GenerationJobRepositoryAdapter implements GenerationJobRepository {
  private readonly logger = new Logger(GenerationJobRepositoryAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async updateProgress(assignmentUuid: string, progress: GenerationProgress): Promise<void> {
    await (this.prisma as any).drillAssignment.update({
      where: { uuid: assignmentUuid },
      data: { generationProgress: progress as any },
    });
  }

  async cancel(assignmentUuid: string, reason: string): Promise<void> {
    await (this.prisma as any).drillAssignment.update({
      where: { uuid: assignmentUuid },
      data: {
        status: 'CANCELLED',
        generationProgress: {
          phase: 'FAILED',
          generated: 0,
          total: 0,
          etaSeconds: null,
          message: reason,
          stalled: false,
        } as any,
      },
    });
    this.logger.warn(`Assignment ${assignmentUuid} cancelled: ${reason}`);
  }

  async findStaleGenerating(olderThanSeconds: number): Promise<{ uuid: string }[]> {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
    return (this.prisma as any).drillAssignment.findMany({
      where: { status: 'GENERATING', createdAt: { lt: cutoff } },
      select: { uuid: true },
    });
  }
}
