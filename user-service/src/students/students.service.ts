import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Student, type UserIdentityMirror } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContextUser } from '../shared/auth.types';
import { buildAvatarUrl } from '../shared/avatar-url.util';
import { buildPaginatedResponse, getPaginationParams } from '../shared/pagination';
import { isStaffUser } from '../shared/staff.util';

const STUDENT_SELF_PATCH_KEYS = new Set([
  'firstName',
  'lastName',
  'email',
  'phone',
  'interfaceLanguage',
  'userCountry',
  'emailAdditional',
  'telegram',
  'whatsapp',
  'phoneAdditional',
  'motivation',
  'portrait',
  'country',
  'invoiceAddress',
  'notLoyal',
  'spamBot',
  'doNotContact',
]);

const STUDENT_STAFF_PATCH_KEYS = new Set(['salesInfo', 'managerId']);

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  toStudentProfile(
    row: Student,
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
      interfaceLanguage: mirror?.interfaceLanguage ?? 'ru',
      userCountry: mirror?.userCountry ?? 'ru',
      notLoyal: row.notLoyal,
      spamBot: row.spamBot,
      doNotContact: row.doNotContact,
      emailAdditional: row.emailAdditional,
      telegram: row.telegram,
      whatsapp: row.whatsapp,
      phoneAdditional: row.phoneAdditional,
      motivation: row.motivation,
      portrait: row.portrait,
      salesInfo: row.salesInfo,
      country: row.country,
      invoiceAddress: row.invoiceAddress,
      managerId: row.managerId,
      readHelp: row.readHelp,
    };
  }

  async getMe(auth: AuthContextUser): Promise<Record<string, unknown>> {
    const row = await this.prisma.student.findUnique({ where: { authUserId: auth.id } });
    if (!row) {
      throw new NotFoundException('Student profile not found');
    }
    const mirror = await this.prisma.userIdentityMirror.findUnique({
      where: { authUserId: auth.id },
    });
    return this.toStudentProfile(row, mirror, auth);
  }

  async patchMe(auth: AuthContextUser, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const row = await this.prisma.student.findUnique({ where: { authUserId: auth.id } });
    if (!row) {
      throw new NotFoundException('Student profile not found');
    }
    const staff = isStaffUser(auth);
    const studentUpdate: Prisma.StudentUpdateInput = {};
    const mirrorUpdate: Prisma.UserIdentityMirrorUpdateInput = {};
    for (const [key, val] of Object.entries(body)) {
      if (val === undefined) {
        continue;
      }
      if (STUDENT_STAFF_PATCH_KEYS.has(key) && !staff) {
        throw new ForbiddenException('Not allowed to update this field');
      }
      if (!STUDENT_SELF_PATCH_KEYS.has(key) && !STUDENT_STAFF_PATCH_KEYS.has(key)) {
        continue;
      }
      if (key === 'firstName') {
        mirrorUpdate.firstName = String(val);
      } else if (key === 'lastName') {
        mirrorUpdate.lastName = String(val);
      } else if (key === 'email') {
        mirrorUpdate.email = String(val);
      } else if (key === 'phone') {
        mirrorUpdate.phone = String(val);
      } else if (key === 'interfaceLanguage') {
        mirrorUpdate.interfaceLanguage = String(val);
      } else if (key === 'userCountry') {
        mirrorUpdate.userCountry = String(val);
      } else if (key === 'emailAdditional') {
        studentUpdate.emailAdditional = String(val);
      } else if (key === 'telegram') {
        studentUpdate.telegram = String(val);
      } else if (key === 'whatsapp') {
        studentUpdate.whatsapp = String(val);
      } else if (key === 'phoneAdditional') {
        studentUpdate.phoneAdditional = String(val);
      } else if (key === 'motivation') {
        studentUpdate.motivation = String(val);
      } else if (key === 'portrait') {
        studentUpdate.portrait = String(val);
      } else if (key === 'country') {
        studentUpdate.country = String(val);
      } else if (key === 'invoiceAddress') {
        studentUpdate.invoiceAddress = String(val);
      } else if (key === 'notLoyal') {
        studentUpdate.notLoyal = Boolean(val);
      } else if (key === 'spamBot') {
        studentUpdate.spamBot = Boolean(val);
      } else if (key === 'doNotContact') {
        studentUpdate.doNotContact = Boolean(val);
      } else if (key === 'salesInfo') {
        studentUpdate.salesInfo = String(val);
      } else if (key === 'managerId') {
        studentUpdate.managerId = val === null ? null : Number(val);
      }
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(studentUpdate).length > 0) {
          await tx.student.update({ where: { id: row.id }, data: studentUpdate });
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
              interfaceLanguage: String(mirrorUpdate.interfaceLanguage ?? 'ru'),
              userCountry: String(mirrorUpdate.userCountry ?? 'ru'),
            },
            update: mirrorUpdate,
          });
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Unique constraint violation');
      }
      throw e;
    }
    const updated = await this.prisma.student.findUniqueOrThrow({ where: { id: row.id } });
    const mirror = await this.prisma.userIdentityMirror.findUnique({ where: { authUserId: auth.id } });
    return this.toStudentProfile(updated, mirror, auth);
  }

  async getById(auth: AuthContextUser, id: number): Promise<Record<string, unknown>> {
    if (!isStaffUser(auth)) {
      throw new ForbiddenException('Staff only');
    }
    const row = await this.prisma.student.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Student not found');
    }
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
    return this.toStudentProfile(row, mirror, syntheticAuth);
  }

  async list(
    auth: AuthContextUser,
    pageStr: string | undefined,
    limitStr: string | undefined,
    country?: string,
    managerId?: string,
    search?: string,
  ): Promise<ReturnType<typeof buildPaginatedResponse<Record<string, unknown>>>> {
    if (!isStaffUser(auth)) {
      throw new ForbiddenException('Staff only');
    }
    const { page, limit, skip } = getPaginationParams(pageStr, limitStr);
    const where: Prisma.StudentWhereInput = {};
    if (country) {
      where.country = country;
    }
    if (managerId !== undefined && managerId !== '') {
      const mid = Number(managerId);
      if (!Number.isNaN(mid)) {
        where.managerId = mid;
      }
    }
    if (search) {
      const mirrors = await this.prisma.userIdentityMirror.findMany({
        where: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { authUserId: true },
      });
      const ids = mirrors.map((m) => m.authUserId);
      if (ids.length === 0) {
        return buildPaginatedResponse([], 0, page, limit);
      }
      where.authUserId = { in: ids };
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    const items: Record<string, unknown>[] = [];
    for (const row of rows) {
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
      items.push(this.toStudentProfile(row, mirror, syntheticAuth));
    }
    return buildPaginatedResponse(items, total, page, limit);
  }

  async upsertBatchFromInternal(items: unknown[]): Promise<{ upserted: number }> {
    let upserted = 0;
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
      const data: Prisma.StudentCreateInput = {
        authUserId,
        legacyPortalUserId: legacyPortalUserId ?? null,
        notLoyal: Boolean(it.notLoyal),
        spamBot: Boolean(it.spamBot),
        doNotContact: Boolean(it.doNotContact),
        emailAdditional: String(it.emailAdditional ?? ''),
        managerId: it.managerId === undefined || it.managerId === null ? null : Number(it.managerId),
        telegram: String(it.telegram ?? ''),
        whatsapp: String(it.whatsapp ?? ''),
        phoneAdditional: String(it.phoneAdditional ?? ''),
        readHelp: Boolean(it.readHelp),
        motivation: String(it.motivation ?? ''),
        portrait: String(it.portrait ?? ''),
        salesInfo: String(it.salesInfo ?? ''),
        country: String(it.country ?? 'ru'),
        invoiceAddress: String(it.invoiceAddress ?? ''),
      };
      await this.prisma.student.upsert({
        where: { authUserId },
        create: data,
        update: {
          legacyPortalUserId: legacyPortalUserId ?? undefined,
          notLoyal: data.notLoyal,
          spamBot: data.spamBot,
          doNotContact: data.doNotContact,
          emailAdditional: data.emailAdditional,
          managerId: data.managerId,
          telegram: data.telegram,
          whatsapp: data.whatsapp,
          phoneAdditional: data.phoneAdditional,
          readHelp: data.readHelp,
          motivation: data.motivation,
          portrait: data.portrait,
          salesInfo: data.salesInfo,
          country: data.country,
          invoiceAddress: data.invoiceAddress,
        },
      });
      upserted += 1;
    }
    return { upserted };
  }
}
