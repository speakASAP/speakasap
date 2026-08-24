import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Teacher, type UserIdentityMirror } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherRoleClientService } from '../auth-client/teacher-role-client.service';
import type { AuthContextUser } from '../shared/auth.types';
import { buildAvatarUrl } from '../shared/avatar-url.util';
import { buildPaginatedResponse, getPaginationParams } from '../shared/pagination';
import { isStaffUser } from '../shared/staff.util';

const TEACHER_SELF_PATCH = new Set(['description', 'coordinatorInfo', 'phone', 'position']);
const TEACHER_STAFF_PATCH = new Set([
  'canGetStudents',
  'languageCode',
  'additionalLanguageCodes',
  'russian',
  'native',
  'languageSupport',
  'passportNumber',
  'address',
  'postalCode',
  'city',
  'addressCz',
  'cityCz',
  'contractName',
  'workSince',
  'contractEnd',
]);

function interfaceLanguageFromRow(row: Teacher): string {
  return row.russian ? 'ru' : 'en';
}

function isoDate(d: Date | null): string | null {
  if (!d) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherRoleClient: TeacherRoleClientService,
  ) {}

  toTeacherProfile(
    row: Teacher,
    langs: string[],
    mirror: UserIdentityMirror | null,
    auth: AuthContextUser,
  ): Record<string, unknown> {
    const firstName = mirror?.firstName ?? auth.firstName ?? '';
    const lastName = mirror?.lastName ?? auth.lastName ?? '';
    const email = mirror?.email ?? auth.email ?? '';
    const phone = mirror?.phone ?? auth.phone ?? '';
    return {
      id: row.id,
      authUserId: row.authUserId,
      firstName,
      lastName,
      email,
      phone,
      avatarUrl: buildAvatarUrl(mirror?.avatarStorageKey),
      interfaceLanguage: interfaceLanguageFromRow(row),
      userCountry: mirror?.userCountry ?? 'ru',
      description: row.description,
      position: row.position,
      contractName: row.contractName,
      passportNumber: row.passportNumber,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      addressCz: row.addressCz,
      cityCz: row.cityCz,
      languageCode: row.languageCode,
      additionalLanguageCodes: langs,
      russian: row.russian,
      native: row.native,
      languageSupport: row.languageSupport,
      canGetStudents: row.canGetStudents,
      coordinatorInfo: row.coordinatorInfo,
      workSince: isoDate(row.workSince),
      contractEnd: isoDate(row.contractEnd),
    };
  }

  private async loadTeacherRow(authUserId: string): Promise<{
    row: Teacher;
    langs: string[];
    mirror: UserIdentityMirror | null;
  }> {
    const row = await this.prisma.teacher.findUnique({ where: { authUserId: authUserId } });
    if (!row) {
      throw new NotFoundException('Teacher profile not found');
    }
    const langs = await this.prisma.teacherAdditionalLanguage.findMany({
      where: { teacherId: row.id },
      select: { languageCode: true },
    });
    const mirror = await this.prisma.userIdentityMirror.findUnique({
      where: { authUserId: authUserId },
    });
    return {
      row,
      langs: langs.map((l) => l.languageCode),
      mirror,
    };
  }

  async getMe(auth: AuthContextUser): Promise<Record<string, unknown>> {
    const { row, langs, mirror } = await this.loadTeacherRow(auth.id);
    return this.toTeacherProfile(row, langs, mirror, auth);
  }

  async patchMe(auth: AuthContextUser, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { row, langs, mirror } = await this.loadTeacherRow(auth.id);
    const staff = isStaffUser(auth);
    const teacherUpdate: Prisma.TeacherUpdateInput = {};
    const mirrorUpdate: Prisma.UserIdentityMirrorUpdateInput = {};
    let langsReplace: string[] | null = null;
    for (const [key, val] of Object.entries(body)) {
      if (val === undefined) {
        continue;
      }
      if (TEACHER_STAFF_PATCH.has(key) && !staff) {
        throw new ForbiddenException('Not allowed to update this field');
      }
      if (!TEACHER_SELF_PATCH.has(key) && !TEACHER_STAFF_PATCH.has(key)) {
        continue;
      }
      if (key === 'phone') {
        mirrorUpdate.phone = String(val);
      } else if (key === 'description') {
        teacherUpdate.description = String(val);
      } else if (key === 'coordinatorInfo') {
        teacherUpdate.coordinatorInfo = String(val);
      } else if (key === 'position') {
        teacherUpdate.position = String(val);
      } else if (key === 'canGetStudents') {
        teacherUpdate.canGetStudents = Boolean(val);
      } else if (key === 'languageCode') {
        teacherUpdate.languageCode = String(val);
      } else if (key === 'additionalLanguageCodes' && Array.isArray(val)) {
        langsReplace = val.map((x) => String(x));
      } else if (key === 'russian') {
        teacherUpdate.russian = Boolean(val);
      } else if (key === 'native') {
        teacherUpdate.native = Boolean(val);
      } else if (key === 'languageSupport') {
        teacherUpdate.languageSupport = Boolean(val);
      } else if (key === 'passportNumber') {
        teacherUpdate.passportNumber = String(val);
      } else if (key === 'address') {
        teacherUpdate.address = String(val);
      } else if (key === 'postalCode') {
        teacherUpdate.postalCode = String(val);
      } else if (key === 'city') {
        teacherUpdate.city = String(val);
      } else if (key === 'addressCz') {
        teacherUpdate.addressCz = String(val);
      } else if (key === 'cityCz') {
        teacherUpdate.cityCz = String(val);
      } else if (key === 'contractName') {
        teacherUpdate.contractName = String(val);
      } else if (key === 'workSince') {
        teacherUpdate.workSince = val === null ? null : new Date(String(val));
      } else if (key === 'contractEnd') {
        teacherUpdate.contractEnd = val === null ? null : new Date(String(val));
      }
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(teacherUpdate).length > 0) {
          await tx.teacher.update({ where: { id: row.id }, data: teacherUpdate });
        }
        if (Object.keys(mirrorUpdate).length > 0) {
          await tx.userIdentityMirror.upsert({
            where: { authUserId: auth.id },
            create: {
              authUserId: auth.id,
              firstName: String(mirrorUpdate.firstName ?? auth.firstName ?? ''),
              lastName: String(mirrorUpdate.lastName ?? auth.lastName ?? ''),
              email: String(mirrorUpdate.email ?? auth.email ?? ''),
              phone: String(mirrorUpdate.phone ?? auth.phone ?? ''),
              interfaceLanguage: String(mirror?.interfaceLanguage ?? 'ru'),
              userCountry: String(mirror?.userCountry ?? 'ru'),
            },
            update: mirrorUpdate,
          });
        }
        if (langsReplace) {
          await tx.teacherAdditionalLanguage.deleteMany({ where: { teacherId: row.id } });
          if (langsReplace.length > 0) {
            await tx.teacherAdditionalLanguage.createMany({
              data: langsReplace.map((code) => ({ teacherId: row.id, languageCode: code })),
            });
          }
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Unique constraint violation');
      }
      throw e;
    }
    return this.getMe(auth);
  }

  async getById(auth: AuthContextUser, id: number): Promise<Record<string, unknown>> {
    const row = await this.prisma.teacher.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Teacher not found');
    }
    if (!isStaffUser(auth) && row.authUserId !== auth.id) {
      throw new ForbiddenException('Forbidden');
    }
    const langs = await this.prisma.teacherAdditionalLanguage.findMany({
      where: { teacherId: row.id },
      select: { languageCode: true },
    });
    const mirror = await this.prisma.userIdentityMirror.findUnique({
      where: { authUserId: row.authUserId },
    });
    const syntheticAuth: AuthContextUser = {
      id: row.authUserId,
      email: mirror?.email ?? null,
      firstName: mirror?.firstName ?? null,
      lastName: mirror?.lastName ?? null,
      phone: mirror?.phone ?? null,
      userType: 'end_user',
    };
    return this.toTeacherProfile(
      row,
      langs.map((l) => l.languageCode),
      mirror,
      syntheticAuth,
    );
  }

  async list(
    auth: AuthContextUser,
    pageStr: string | undefined,
    limitStr: string | undefined,
    languageCode?: string,
  ): Promise<ReturnType<typeof buildPaginatedResponse<Record<string, unknown>>>> {
    if (!isStaffUser(auth)) {
      throw new ForbiddenException('Staff only');
    }
    const { page, limit, skip } = getPaginationParams(pageStr, limitStr);
    const where: Prisma.TeacherWhereInput = {};
    if (languageCode) {
      where.languageCode = languageCode;
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.teacher.count({ where }),
      this.prisma.teacher.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    const items: Record<string, unknown>[] = [];
    for (const row of rows) {
      const langs = await this.prisma.teacherAdditionalLanguage.findMany({
        where: { teacherId: row.id },
        select: { languageCode: true },
      });
      const mirror = await this.prisma.userIdentityMirror.findUnique({
        where: { authUserId: row.authUserId },
      });
      const syntheticAuth: AuthContextUser = {
        id: row.authUserId,
        email: mirror?.email ?? null,
        firstName: mirror?.firstName ?? null,
        lastName: mirror?.lastName ?? null,
        phone: mirror?.phone ?? null,
        userType: 'end_user',
      };
      items.push(
        this.toTeacherProfile(
          row,
          langs.map((l) => l.languageCode),
          mirror,
          syntheticAuth,
        ),
      );
    }
    return buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * Portal sync's only ingress for Teacher rows, and therefore the only place a new
   * teacher can be granted `app:speakasap:teacher` automatically. Without the grant a
   * synced teacher is a teacher in this database but an ordinary user to Auth, and the
   * teacher portal answers 403.
   *
   * The grant runs after each upsert commits, so a failing grant leaves a repairable
   * state: the row exists and the next sync run retries the grant. The failure is
   * re-thrown rather than counted, because a partial sync reported as success is how a
   * locked-out teacher goes unnoticed.
   */
  async upsertBatchFromInternal(
    items: unknown[],
  ): Promise<{ upserted: number; rolesGranted: number }> {
    let upserted = 0;
    let rolesGranted = 0;
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const it = raw as Record<string, unknown>;
      const authUserId = it.authUserId;
      if (typeof authUserId !== 'string') {
        throw new BadRequestException('Each item must have authUserId string');
      }
      const legacyPortalUserId =
        typeof it.legacyPortalUserId === 'number' ? it.legacyPortalUserId : undefined;
      const languageCode = typeof it.languageCode === 'string' ? it.languageCode : 'en';
      const additional =
        Array.isArray(it.additionalLanguageCodes) ?
          (it.additionalLanguageCodes as unknown[]).map((x) => String(x)) :
          [];
      const createData: Prisma.TeacherCreateInput = {
        authUserId,
        legacyPortalUserId: legacyPortalUserId ?? null,
        description: it.description === undefined || it.description === null ? null : String(it.description),
        position: String(it.position ?? ''),
        contractName: String(it.contractName ?? ''),
        passportNumber: String(it.passportNumber ?? ''),
        address: String(it.address ?? ''),
        postalCode: String(it.postalCode ?? ''),
        city: String(it.city ?? ''),
        addressCz: String(it.addressCz ?? ''),
        cityCz: String(it.cityCz ?? ''),
        languageCode,
        russian: Boolean(it.russian),
        native: Boolean(it.native),
        languageSupport: Boolean(it.languageSupport),
        canGetStudents: Boolean(it.canGetStudents),
        coordinatorInfo: String(it.coordinatorInfo ?? ''),
        workSince: it.workSince ? new Date(String(it.workSince)) : null,
        contractEnd: it.contractEnd ? new Date(String(it.contractEnd)) : null,
      };
      const row = await this.prisma.teacher.upsert({
        where: { authUserId },
        create: createData,
        update: {
          legacyPortalUserId: legacyPortalUserId ?? undefined,
          description: createData.description ?? undefined,
          position: createData.position,
          contractName: createData.contractName,
          passportNumber: createData.passportNumber,
          address: createData.address,
          postalCode: createData.postalCode,
          city: createData.city,
          addressCz: createData.addressCz,
          cityCz: createData.cityCz,
          languageCode: createData.languageCode,
          russian: createData.russian,
          native: createData.native,
          languageSupport: createData.languageSupport,
          canGetStudents: createData.canGetStudents,
          coordinatorInfo: createData.coordinatorInfo,
          workSince: createData.workSince ?? undefined,
          contractEnd: createData.contractEnd ?? undefined,
        },
      });
      await this.prisma.teacherAdditionalLanguage.deleteMany({ where: { teacherId: row.id } });
      if (additional.length > 0) {
        await this.prisma.teacherAdditionalLanguage.createMany({
          data: additional.map((code) => ({ teacherId: row.id, languageCode: code })),
        });
      }
      upserted += 1;

      const { granted } = await this.teacherRoleClient.grantTeacherRole(authUserId);
      if (granted) {
        rolesGranted += 1;
      }
    }
    return { upserted, rolesGranted };
  }
}
