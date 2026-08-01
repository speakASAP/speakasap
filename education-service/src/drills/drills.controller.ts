import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { isStaffUser } from '../shared/staff-access';
import { RunnerService } from './runner/runner.service';
import { SelfDrillService } from './runner/self-drill.service';
import { DrillAssignmentsService } from './runner/assignments.service';
import {
  CheckBlankRequest,
  CheckBlankResponse,
  DrillAssignmentDTO,
  InternalTeacherAssignmentsResponse,
  RunnerResponse,
} from './contracts';

/**
 * Resolves the authenticated principal to the numeric legacy student id that
 * `DrillAssignment.studentId` is keyed on.
 *
 * The JWT carries a UUID (`AuthContextUser.id`) while the drill tables carry the
 * legacy Django integer. Bridging the two is Track H/I's job
 * (`POST /internal/users/resolve-or-provision-legacy`), not this controller's, so
 * it is taken as an injected boundary rather than reimplemented here.
 */
export interface DrillIdentityResolver {
  resolveStudentId(authUserId: string): Promise<number>;
}

export const DRILL_IDENTITY_RESOLVER = 'DRILL_IDENTITY_RESOLVER';

@Controller('drill-assignments')
@UseGuards(JwtAuthGuard)
export class DrillsController {
  private readonly logger = new Logger(DrillsController.name);

  constructor(
    private readonly runner: RunnerService,
    private readonly selfDrill: SelfDrillService,
    private readonly assignments: DrillAssignmentsService,
    // Track D: DrillIdentityResolver is a TypeScript interface, which erases at
    // runtime and therefore carries no DI token of its own. This is the one line
    // Track D added to a Track B2 file — without it the container cannot bind the
    // resolver and the service does not start.
    @Inject(DRILL_IDENTITY_RESOLVER) private readonly identity: DrillIdentityResolver,
  ) {}

  /** The student's own assignment list. */
  @Get()
  async listMine(@Req() req: Request) {
    const studentId = await this.studentId(req);
    return this.assignments.listForStudent(studentId);
  }

  /**
   * The runner payload. Answer-free — `toRunnerResponse` builds it by explicit
   * field list, and a controller-level test re-asserts the absence of answers
   * because a projection test cannot prove this layer did not add them back.
   */
  @Get(':uuid/runner')
  async getRunner(@Param('uuid') uuid: string, @Req() req: Request): Promise<RunnerResponse> {
    const studentId = await this.studentId(req);
    return this.assignments.getRunner(uuid, studentId);
  }

  @Post(':uuid/check')
  @HttpCode(HttpStatus.OK)
  async check(
    @Param('uuid') uuid: string,
    @Body() body: CheckBlankRequest,
    @Req() req: Request,
  ): Promise<CheckBlankResponse> {
    if (!body?.itemUuid) {
      throw new BadRequestException('itemUuid is required');
    }
    if (typeof body?.blankIndex !== 'number') {
      throw new BadRequestException('numeric blankIndex is required');
    }
    const studentId = await this.studentId(req);
    return this.runner.check(uuid, studentId, body);
  }

  /** Self-selected drilling. The gate lives in SelfDrillService, server-side. */
  @Post('self')
  @HttpCode(HttpStatus.CREATED)
  async startSelfDrill(
    @Body() body: { setUuid?: string },
    @Req() req: Request,
  ): Promise<DrillAssignmentDTO> {
    if (!body?.setUuid) {
      throw new BadRequestException('setUuid is required');
    }
    const studentId = await this.studentId(req);
    return this.selfDrill.startSelfDrill(studentId, body.setUuid);
  }

  /** Teacher-only. Staff role required — a student token is refused. */
  @Get('teacher/summary')
  async teacherSummary(@Req() req: Request): Promise<InternalTeacherAssignmentsResponse> {
    this.assertStaff(req);
    const teacherId = await this.identity.resolveStudentId(req.authUser!.id);
    return this.assignments.listForTeacher(teacherId);
  }

  private assertStaff(req: Request): void {
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Staff access required');
    }
  }

  private async studentId(req: Request): Promise<number> {
    return this.identity.resolveStudentId(req.authUser!.id);
  }
}
