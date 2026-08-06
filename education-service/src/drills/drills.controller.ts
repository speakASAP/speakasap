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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { isStaffUser } from '../shared/staff-access';
import { RunnerService } from './runner/runner.service';
import { SelfDrillService } from './runner/self-drill.service';
import { DrillAssignmentsService } from './runner/assignments.service';
import { TeacherAssignmentsService } from './teacher/teacher-assignments.service';
import { TeacherRosterService } from './teacher/roster.service';
import { ContentClient } from './orchestration/content.client';
import {
  AssignFromSetRequest,
  AssignFromSetResponse,
  CheckBlankRequest,
  CheckBlankResponse,
  DrillAssignmentDTO,
  DrillSetDetailDTO,
  DrillTeacherRosterResponse,
  GenerateAssignmentsRequest,
  GenerateAssignmentsResponse,
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
    private readonly teacherAssignments: TeacherAssignmentsService,
    private readonly roster: TeacherRosterService,
    private readonly sets: ContentClient,
  ) {}

  /** The student's own assignment list. */
  @Get()
  async listMine(@Req() req: Request) {
    const studentId = await this.studentId(req);
    return this.assignments.listForStudent(studentId);
  }

  /**
   * Teacher-only. Queues generation and returns immediately with the assignment uuids.
   *
   * Declared before `:uuid/...` routes below: Nest matches in declaration order, so a
   * parameterised route registered first would swallow `generate` as a uuid.
   */
  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(
    @Body() body: GenerateAssignmentsRequest,
    @Req() req: Request,
  ): Promise<GenerateAssignmentsResponse> {
    this.assertStaff(req);
    const lessonUuid = this.assertLesson(body?.lessonUuid);
    const teacherId = await this.resolveTeacherId(req, lessonUuid);
    return this.teacherAssignments.generate(teacherId, body, this.bearer(req));
  }

  /** Teacher-only. Assigns an already-approved set, no generation. */
  @Post('assign')
  @HttpCode(HttpStatus.CREATED)
  async assign(
    @Body() body: AssignFromSetRequest,
    @Req() req: Request,
  ): Promise<AssignFromSetResponse> {
    this.assertStaff(req);
    const lessonUuid = this.assertLesson(body?.lessonUuid);
    const teacherId = await this.resolveTeacherId(req, lessonUuid);
    return this.teacherAssignments.assignFromSet(teacherId, body, this.bearer(req));
  }

  /**
   * Teacher-only. The students this teacher may assign drilling to.
   *
   * Paged: a teacher with 656 students (production, teacher 10) is not a dropdown.
   * `search` matches the resolved name, falling back to the id for students auth has
   * no mapping for. Omitting all three returns the first page, so callers written
   * against the unpaged version keep working.
   */
  @Get('teacher/students')
  async teacherStudents(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('lessonUuid') lessonUuid?: string,
  ): Promise<DrillTeacherRosterResponse> {
    this.assertStaff(req);

    // Scoped to a lesson when the caller names one. `Lesson.teacherId` is the legacy
    // Teacher profile pk (182) while `resolveStudentId` returns the user id (3), and this
    // service holds no mapping between them — so a teacher arriving from a lesson page
    // would otherwise be matched against the wrong id space and see someone else's
    // roster, or an empty one. The lesson names its own teacher and students.
    if (lessonUuid) {
      const scoped = await this.roster.listForLesson(lessonUuid, {
        search,
        limit: limit === undefined ? undefined : Number(limit),
        offset: offset === undefined ? undefined : Number(offset),
      });
      const { teacherId: _lessonTeacherId, ...response } = scoped;
      return response;
    }

    const teacherId = await this.identity.resolveStudentId(req.authUser!.id);
    return this.roster.listForTeacher(teacherId, {
      search,
      limit: limit === undefined ? undefined : Number(limit),
      offset: offset === undefined ? undefined : Number(offset),
    });
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

  /**
   * Reveal one blank's answer — spec §9.6.
   *
   * The only student-facing route that deliberately returns an answer, and only for the
   * blank the student explicitly asked about. It costs them the blank: the position
   * resolves without ever counting as correct.
   */
  @Post(':uuid/reveal')
  @HttpCode(HttpStatus.OK)
  async reveal(
    @Param('uuid') uuid: string,
    @Body() body: { itemUuid?: string; blankIndex?: number },
    @Req() req: Request,
  ): Promise<CheckBlankResponse> {
    if (!body?.itemUuid) {
      throw new BadRequestException('itemUuid is required');
    }
    if (typeof body?.blankIndex !== 'number') {
      throw new BadRequestException('numeric blankIndex is required');
    }
    const studentId = await this.studentId(req);
    return this.runner.reveal(uuid, studentId, {
      itemUuid: body.itemUuid,
      blankIndex: body.blankIndex,
    });
  }

  /** Self-selected drilling. The gate lives in SelfDrillService, server-side. */
  @Post('self')
  @HttpCode(HttpStatus.CREATED)
  async startSelfDrill(
    @Body() body: { setUuid?: string; lessonUuid?: string | null },
    @Req() req: Request,
  ): Promise<DrillAssignmentDTO> {
    if (!body?.setUuid) {
      throw new BadRequestException('setUuid is required');
    }
    const studentId = await this.studentId(req);
    // Optional, unlike teacher-origin work: a student starting from a lesson's homework
    // names it so the drill appears there, while one starting from the drills menu has
    // no lesson to name.
    const lessonUuid = typeof body.lessonUuid === 'string' ? body.lessonUuid.trim() : '';
    return this.selfDrill.startSelfDrill(studentId, body.setUuid, lessonUuid || null);
  }

  /** Teacher-only. Staff role required — a student token is refused. */
  @Get('teacher/summary')
  async teacherSummary(@Req() req: Request): Promise<InternalTeacherAssignmentsResponse> {
    this.assertStaff(req);
    const teacherId = await this.identity.resolveStudentId(req.authUser!.id);
    return this.assignments.listForTeacher(teacherId);
  }

  /**
   * One assignment, for the teacher who created it — this is what the wizard polls for
   * `generationProgress`.
   *
   * Declared last of the GETs: `:uuid` matches any single segment, so registering it
   * above `teacher/summary` or `teacher/students` would capture both as uuids.
   */
  @Get(':uuid')
  async getOne(
    @Param('uuid') uuid: string,
    @Req() req: Request,
  ): Promise<DrillAssignmentDTO> {
    this.assertStaff(req);
    // Both id spaces: assignments created before the lesson-teacher fix carry the legacy
    // user id, newer ones carry the Teacher profile pk. Same person either way.
    const userId = await this.identity.resolveStudentId(req.authUser!.id);
    const lessonTeacherId = await this.teacherIdForAssignment(uuid);
    return this.teacherAssignments.getForTeacher(
      uuid,
      lessonTeacherId === null ? [userId] : [userId, lessonTeacherId],
    );
  }

  /**
   * One assignment's progress, for the teacher: every blank, its answer, whether the
   * student solved it, and the wrong answers they typed.
   *
   * Ownership accepts both id spaces, same as `getForTeacher`.
   */
  @Get('teacher/progress/:uuid')
  async teacherProgress(@Param('uuid') uuid: string, @Req() req: Request): Promise<unknown> {
    this.assertStaff(req);
    const userId = await this.identity.resolveStudentId(req.authUser!.id);
    const lessonTeacherId = await this.teacherIdForAssignment(uuid);
    return this.teacherAssignments.progressForTeacher(
      uuid,
      lessonTeacherId === null ? [userId] : [userId, lessonTeacherId],
    );
  }

  /**
   * A drill set with its answers, for the teacher review screen.
   *
   * Proxies content-service's `internal/drill-sets/:uuid`, which the gateway gates on
   * `x-internal-token` — a credential a browser cannot hold, so the review screen 404'd
   * against the public path.
   *
   * The route cannot simply be exposed on content-service: that service has no auth
   * guard, and the gateway validates a token without checking any role, so a public
   * prefix there would let any authenticated student read the answer bank. Here the
   * staff check happens first, and the service's own internal token is used for the
   * upstream hop.
   */
  @Get('teacher/sets/:setUuid')
  async teacherSet(
    @Param('setUuid') setUuid: string,
    @Req() req: Request,
  ): Promise<DrillSetDetailDTO> {
    this.assertStaff(req);
    return this.sets.getSet(setUuid, this.bearer(req));
  }

  /**
   * The id to attribute an assignment to.
   *
   * `Lesson.teacherId` is the legacy **Teacher profile pk** (182 for the user whose auth
   * id resolves to 3), so storing `resolveStudentId`'s answer made
   * `DrillAssignment.teacherId` mean something different from the identically-named
   * column on Lesson — two id spaces in one database.
   *
   * When a lesson is named it is authoritative and needs no cross-database mapping.
   * Without one there is nothing to read the profile pk from, so the previous behaviour
   * stands rather than guessing: `employees_teacher` lives in the portal's database,
   * which this service cannot reach.
   */
  /**
   * Teacher-origin work is created *within* a lesson, and this is where that is
   * enforced.
   *
   * A teacher assigns drilling from a lesson page: the student roster itself is
   * lesson-scoped (`roster.listForLesson`), so with no lesson there is no principled
   * set of students to assign to. Attribution is the sharper problem — without a
   * lesson, `resolveTeacherId` used to fall back to the caller's legacy user id, which
   * writes a different numbering space into `teacher_id` than the Teacher profile pk
   * every other row holds. `teacherIdForAssignment` then derives the teacher from the
   * lesson, finds none, and the ownership check that accepts "the lesson's teacher" has
   * nothing to match against.
   *
   * Hiding the wizard is not this gate. Track J's legacy portal and a hand-crafted POST
   * both reach these methods directly.
   *
   * SELF origin is deliberately out of scope: a student practising from the drills menu
   * has no lesson, and `startSelfDrill` has its own gates.
   */
  private assertLesson(lessonUuid: unknown): string {
    const value = typeof lessonUuid === 'string' ? lessonUuid.trim() : '';
    if (!value) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'LESSON_REQUIRED',
        message: 'Choose a lesson before assigning drilling',
      });
    }
    return value;
  }

  private async resolveTeacherId(req: Request, lessonUuid: string | null): Promise<number> {
    if (lessonUuid) {
      const scoped = await this.roster.listForLesson(lessonUuid);
      if (scoped.teacherId) {
        return scoped.teacherId;
      }
      this.logger.warn(
        `Lesson ${lessonUuid} records no teacher; attributing to the caller's legacy user id`,
      );
    }
    return this.identity.resolveStudentId(req.authUser!.id);
  }

  /**
   * The Teacher profile pk recorded on the assignment's lesson, if it has one. Lets
   * ownership accept an assignment attributed to the lesson teacher as well as one
   * attributed to the caller's legacy user id.
   */
  private async teacherIdForAssignment(assignmentUuid: string): Promise<number | null> {
    const lessonUuid = await this.teacherAssignments.lessonUuidFor(assignmentUuid);
    if (!lessonUuid) {
      return null;
    }
    const scoped = await this.roster.listForLesson(lessonUuid);
    return scoped.teacherId ?? null;
  }

  /**
   * Approve a set, for the teacher review screen.
   *
   * Proxies content-service's `internal/drill-sets/:uuid/approve`, which the gateway
   * gates on `x-internal-token` — the browser called the public path and got a bare 404
   * with nothing on screen.
   *
   * That route trusts `teacherId` from its body outright, so the value comes from this
   * service's own resolution of the caller. Accepting it from the browser would let a
   * teacher approve a set in someone else's name.
   */
  @Post('teacher/sets/:setUuid/approve')
  @HttpCode(HttpStatus.OK)
  async approveSet(@Param('setUuid') setUuid: string, @Req() req: Request): Promise<unknown> {
    this.assertStaff(req);
    const teacherId = await this.identity.resolveStudentId(req.authUser!.id);
    this.logger.log(`Approving set ${setUuid} for teacher ${teacherId}`);
    const approved = await this.sets.approveSet(setUuid, teacherId, this.bearer(req));

    // Approve also assigns. Generation creates the assignment rows and leaves the
    // sentences on the set, so without this the teacher approved, saw success, and the
    // student received an assignment with no items — or never saw it at all, because a
    // PENDING_REVIEW row is not in their list.
    //
    // Strictly after approval: delivering a drill from a set that failed to approve
    // would put unreviewed sentences in front of a student.
    const delivered = await this.teacherAssignments.assignApprovedSet(
      setUuid,
      teacherId,
      this.bearer(req),
    );
    this.logger.log(`Set ${setUuid} approved and delivered to ${delivered} assignment(s)`);

    return approved;
  }

  private assertStaff(req: Request): void {
    if (!isStaffUser(req.authUser)) {
      throw new ForbiddenException('Staff access required');
    }
  }

  private async studentId(req: Request): Promise<number> {
    return this.identity.resolveStudentId(req.authUser!.id);
  }

  /**
   * The caller's bearer token, forwarded to content-service and ai-microservice.
   *
   * The generation pipeline calls both on the teacher's behalf, and `GenerationJob.token`
   * is that credential. Taken from the header the guard already validated rather than
   * substituting a service token: the upstream routes that carry answers additionally
   * require `x-internal-token`, which the clients add themselves, so forwarding the
   * teacher's token keeps the request attributable without widening what it can reach.
   */
  private bearer(req: Request): string {
    const header = req.headers?.authorization ?? '';
    return header.startsWith('Bearer ') ? header.slice(7) : '';
  }
}
