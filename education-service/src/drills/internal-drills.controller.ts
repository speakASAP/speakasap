import { BadRequestException, Controller, Get, Param, UseGuards } from '@nestjs/common';
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
  constructor(private readonly assignments: DrillAssignmentsService) {}

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
}

function numeric(value: string, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequestException(`numeric ${field} is required`);
  }
  return n;
}
