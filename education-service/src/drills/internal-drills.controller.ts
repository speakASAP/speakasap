import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ContentClient } from './orchestration/content.client';
import { TeacherAssignmentsService } from './teacher/teacher-assignments.service';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { DrillAssignmentsService } from './runner/assignments.service';
import {
  InternalLessonAssignmentsResponse,
  InternalStudentAssignmentsResponse,
  InternalTeacherAssignmentsResponse,
} from './contracts';

/**
 * Contract C8 — the transitional endpoints the legacy portal (Track J) reads.
 *
 * Behind `InternalTokenGuard`, not the JWT guard: the caller is the portal
 * itself, a service, not an end user. These return other people's assignment
 * data by id, so they must never be reachable with an ordinary bearer token.
 */
@Controller('internal/drill-assignments')
@UseGuards(InternalTokenGuard)
export class InternalDrillsController {
  private readonly logger = new Logger(InternalDrillsController.name);

  constructor(
    private readonly assignments: DrillAssignmentsService,
    private readonly teacherAssignments: TeacherAssignmentsService,
    private readonly sets: ContentClient,
  ) {}

  @Get('by-student/:studentId')
  async byStudent(@Param('studentId') studentId: string): Promise<InternalStudentAssignmentsResponse> {
    return this.assignments.listForStudent(numeric(studentId, 'studentId'));
  }

  @Get('by-teacher/:teacherId')
  async byTeacher(@Param('teacherId') teacherId: string): Promise<InternalTeacherAssignmentsResponse> {
    return this.assignments.listForTeacher(numeric(teacherId, 'teacherId'));
  }

  @Get('by-lesson/:lessonUuid')
  async byLesson(@Param('lessonUuid') lessonUuid: string): Promise<InternalLessonAssignmentsResponse> {
    if (!lessonUuid) {
      throw new BadRequestException('lessonUuid is required');
    }
    return this.assignments.listForLesson(lessonUuid);
  }

  /**
   * Approve a set and deliver it, on behalf of the teacher the portal names.
   *
   * `InternalTokenGuard` proves the portal is calling — it is one shared service
   * credential and says nothing about which teacher is acting. `teacherId` therefore
   * comes in the body, and the service checks that the teacher actually owns what they
   * are touching. Without that check, anything holding the internal token could act as
   * any teacher.
   */
  @Post('sets/:setUuid/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('setUuid') setUuid: string,
    @Body() body: { teacherId?: number },
  ): Promise<{ delivered: number }> {
    const teacherId = numeric(String(body?.teacherId ?? ''), 'teacherId');
    const token = process.env.INTERNAL_API_TOKEN ?? '';

    this.logger.log(`Portal approve: set=${setUuid} teacher=${teacherId}`);
    await this.sets.approveSet(setUuid, teacherId, token);
    const delivered = await this.teacherAssignments.assignApprovedSet(setUuid, teacherId, token);

    return { delivered };
  }

  /** Revoke an assignment on behalf of the teacher the portal names. */
  @Post(':assignmentUuid/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Param('assignmentUuid') assignmentUuid: string,
    @Body() body: { teacherId?: number },
  ): Promise<{ revoked: true }> {
    const teacherId = numeric(String(body?.teacherId ?? ''), 'teacherId');

    this.logger.log(`Portal revoke: assignment=${assignmentUuid} teacher=${teacherId}`);
    await this.teacherAssignments.revokeAssignment(assignmentUuid, [teacherId]);

    return { revoked: true };
  }
}

function numeric(value: string, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequestException(`numeric ${field} is required`);
  }
  return n;
}