import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { LessonRecord } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import type { AuthContextUser } from '../shared/auth.types';
import { isStaffUser } from '../shared/staff-access';
import { PrismaService } from '../prisma/prisma.service';
import { LessonRecordMediaTokenService } from './media-token.service';
import { LessonRecordStorageService } from './storage.service';
import { UserProfilesClient } from './user-profiles.client';

type AccessMode = 'state' | 'playback' | 'teacher-write';
const MAX_RECORD_SIZE = 60 * 1024 * 1024;

function partsArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
}

function recordState(record: LessonRecord | null): 'none' | 'processing' | 'ready' | 'unavailable' {
  if (!record) {
    return 'none';
  }
  if (record.recordKey && record.processed) {
    return 'ready';
  }
  if (!record.processed && (record.recordKey || partsArray(record.parts).length > 0)) {
    return 'processing';
  }
  return 'unavailable';
}

@Injectable()
export class LessonRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserProfilesClient,
    private readonly mediaTokens: LessonRecordMediaTokenService,
    private readonly storage: LessonRecordStorageService,
  ) {}

  async getState(lessonUuid: string, auth: AuthContextUser, bearerToken: string) {
    const { lesson, record } = await this.loadLessonAndRecord(lessonUuid);
    await this.assertDomainAccess(lesson, auth, bearerToken, 'state');
    const state = recordState(record);
    return {
      lessonUuid,
      lessonRecordUuid: record?.uuid ?? null,
      state,
      recordUnavailable: record?.recordUnavailable ?? '',
      recordKey: record?.recordKey ? 'private' : null,
      playbackUrl: state === 'ready' ? `/api/v1/lessons/${lessonUuid}/record/playback` : null,
      durationSeconds: null,
      updatedAt: record?.updatedAt?.toISOString() ?? null,
    };
  }

  async createPlaybackAccess(lessonUuid: string, auth: AuthContextUser, bearerToken: string) {
    const { lesson, record } = await this.loadLessonAndRecord(lessonUuid);
    await this.assertDomainAccess(lesson, auth, bearerToken, 'playback');
    if (!record || recordState(record) !== 'ready' || !record.recordKey) {
      throw new NotFoundException('Ready lesson record not found');
    }
    const token = this.mediaTokens.sign({
      lessonUuid,
      recordUuid: record.uuid,
      scope: 'playback',
      userId: auth.id,
    });
    return {
      lessonUuid,
      lessonRecordUuid: record.uuid,
      access: {
        mode: 'gateway-download',
        method: 'GET',
        url: `/api/v1/lessons/${lessonUuid}/record/download?token=${encodeURIComponent(token.token)}`,
        expiresAt: token.expiresAt,
        expiresIn: token.expiresIn,
      },
    };
  }

  async streamDownload(lessonUuid: string, token: string, rangeHeader: string | undefined, res: Response) {
    if (!token) {
      throw new ForbiddenException('Media token is required');
    }
    const payload = this.mediaTokens.verify(token, lessonUuid, 'playback');
    const record = await this.prisma.lessonRecord.findUnique({ where: { uuid: payload.recordUuid } });
    if (!record || record.lessonUuid !== lessonUuid || recordState(record) !== 'ready' || !record.recordKey) {
      throw new NotFoundException('Ready lesson record not found');
    }
    await this.storage.streamRecord(record.recordKey, rangeHeader, res);
  }

  async presignUpload(lessonUuid: string, auth: AuthContextUser, bearerToken: string, body: Record<string, unknown>) {
    const { lesson } = await this.loadLessonAndRecord(lessonUuid);
    await this.assertDomainAccess(lesson, auth, bearerToken, 'teacher-write');
    const filename = requiredString(body.filename, 'filename');
    const contentType = requiredString(body.contentType ?? body.content_type, 'contentType');
    const kind = requiredString(body.kind, 'kind');
    const size = Number(body.size);
    if (kind !== 'lesson' && kind !== 'part') {
      throw new BadRequestException('kind must be lesson or part');
    }
    if (!contentType.startsWith('audio/')) {
      throw new BadRequestException('contentType must start with audio/');
    }
    if (!Number.isInteger(size) || size < 0 || size > MAX_RECORD_SIZE) {
      throw new BadRequestException('size must be an integer between 0 and 62914560');
    }
    const requestedStudentId = optionalInteger(body.studentId ?? body.student_id);
    if (requestedStudentId !== null && !lesson.studentCourse.group.groupStudents.some((s) => s.studentId === requestedStudentId)) {
      throw new BadRequestException('studentId is not attached to lesson group');
    }
    const partUuid = kind === 'part' ? randomUUID() : null;
    const key = kind === 'lesson' ? lessonKey(lesson.uuid, lesson.start, filename) : partKey(partUuid!, lesson.start, filename);
    const signed = this.storage.presignPut(key, contentType, 900);
    return {
      method: 'PUT',
      url: signed.url,
      key,
      headers: { 'Content-Type': contentType },
      partUuid,
      expiresIn: signed.expiresIn,
    };
  }

  async commitUpload(lessonUuid: string, auth: AuthContextUser, bearerToken: string, body: Record<string, unknown>) {
    const { lesson } = await this.loadLessonAndRecord(lessonUuid);
    await this.assertDomainAccess(lesson, auth, bearerToken, 'teacher-write');
    const items = Array.isArray(body.items) ? body.items : [];
    const recordUnavailable = typeof body.recordUnavailable === 'string'
      ? body.recordUnavailable.trim()
      : typeof body.record_unavailable === 'string'
        ? body.record_unavailable.trim()
        : '';
    if (items.length === 0 && !recordUnavailable) {
      throw new BadRequestException('items or recordUnavailable is required');
    }
    const expectedItems = [];
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') {
        throw new BadRequestException('each item must be an object');
      }
      const item = raw as Record<string, unknown>;
      const kind = requiredString(item.kind, 'kind');
      const key = requiredString(item.key, 'key');
      const filename = typeof item.filename === 'string' && item.filename.trim() ? item.filename.trim() : 'record.mp3';
      const size = Number(item.size);
      const etag = typeof item.etag === 'string' ? item.etag.replace(/"/g, '').trim() : '';
      if (!Number.isInteger(size) || size < 0 || size > MAX_RECORD_SIZE) {
        throw new BadRequestException('item size is invalid');
      }
      if (kind === 'lesson') {
        const expectedKey = lessonKey(lesson.uuid, lesson.start, filename);
        if (key !== expectedKey) {
          throw new BadRequestException('lesson key mismatch');
        }
        expectedItems.push({ kind, key, size, etag, partUuid: null });
      } else if (kind === 'part') {
        const partUuid = requiredString(item.partUuid ?? item.part_uuid, 'partUuid');
        const expectedKey = partKey(partUuid, lesson.start, filename);
        if (key !== expectedKey) {
          throw new BadRequestException('part key mismatch');
        }
        expectedItems.push({ kind, key, size, etag, partUuid });
      } else {
        throw new BadRequestException('kind must be lesson or part');
      }
    }
    for (const item of expectedItems) {
      const meta = await this.storage.headObject(item.key);
      if (item.etag && item.etag !== meta.etag) {
        throw new BadRequestException(`ETag mismatch for key ${item.key}`);
      }
      if (item.size !== meta.size) {
        throw new BadRequestException(`Size mismatch for key ${item.key}`);
      }
    }
    const existing = await this.prisma.lessonRecord.findUnique({ where: { lessonUuid: lesson.uuid } });
    const recordUuid = existing?.uuid ?? randomUUID();
    const lessonItems = expectedItems.filter((i) => i.kind === 'lesson');
    const partItems = expectedItems.filter((i) => i.kind === 'part');
    await this.prisma.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { uuid: lesson.uuid },
        data: {
          recommendation: typeof body.recommendation === 'string' ? body.recommendation : lesson.recommendation,
          toManager: typeof body.toManager === 'string'
            ? body.toManager
            : typeof body.to_manager === 'string'
              ? body.to_manager
              : lesson.toManager,
        },
      });
      if (lessonItems.length > 0) {
        await tx.lessonRecord.upsert({
          where: { lessonUuid: lesson.uuid },
          create: {
            uuid: recordUuid,
            lessonUuid: lesson.uuid,
            recordKey: lessonItems[0].key,
            processed: true,
            recordUnavailable: '',
            parts: [],
          },
          update: {
            recordKey: lessonItems[0].key,
            processed: true,
            recordUnavailable: '',
            parts: [],
          },
        });
        await tx.lessonRecordPart.deleteMany({ where: { lessonRecordUuid: recordUuid } });
      } else if (partItems.length > 0) {
        await tx.lessonRecord.upsert({
          where: { lessonUuid: lesson.uuid },
          create: {
            uuid: recordUuid,
            lessonUuid: lesson.uuid,
            recordKey: null,
            processed: false,
            recordUnavailable: '',
            parts: partItems.map((i) => i.partUuid),
          },
          update: {
            recordKey: null,
            processed: false,
            recordUnavailable: '',
            parts: partItems.map((i) => i.partUuid),
          },
        });
        await tx.lessonRecordPart.deleteMany({ where: { lessonRecordUuid: recordUuid } });
        for (const item of partItems) {
          await tx.lessonRecordPart.create({
            data: {
              uuid: item.partUuid!,
              lessonRecordUuid: recordUuid,
              partKey: item.key,
            },
          });
        }
      } else {
        await tx.lessonRecord.upsert({
          where: { lessonUuid: lesson.uuid },
          create: {
            uuid: recordUuid,
            lessonUuid: lesson.uuid,
            recordKey: null,
            processed: true,
            recordUnavailable,
            parts: [],
          },
          update: {
            recordKey: null,
            processed: true,
            recordUnavailable,
            parts: [],
          },
        });
        await tx.lessonRecordPart.deleteMany({ where: { lessonRecordUuid: recordUuid } });
      }
    });
    return { status: 'ok', lessonRecordUuid: recordUuid };
  }

  async requestMerge(lessonUuid: string, auth: AuthContextUser, bearerToken: string): Promise<never> {
    const { lesson } = await this.loadLessonAndRecord(lessonUuid);
    await this.assertDomainAccess(lesson, auth, bearerToken, 'teacher-write');
    throw new ServiceUnavailableException('Target merge worker is not implemented; legacy merge remains authoritative');
  }

  async deleteRecord(lessonUuid: string, auth: AuthContextUser, bearerToken: string): Promise<never> {
    const { lesson } = await this.loadLessonAndRecord(lessonUuid);
    await this.assertDomainAccess(lesson, auth, bearerToken, 'teacher-write');
    throw new ConflictException('Target record deletion is disabled until owner-approved object deletion exists');
  }

  private async loadLessonAndRecord(lessonUuid: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { uuid: lessonUuid },
      include: {
        lessonRecord: true,
        studentAccesses: true,
        studentCourse: { include: { group: { include: { groupStudents: true } } } },
      },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    return { lesson, record: lesson.lessonRecord };
  }

  private async assertDomainAccess(
    lesson: Awaited<ReturnType<LessonRecordsService['loadLessonAndRecord']>>['lesson'],
    auth: AuthContextUser,
    bearerToken: string,
    mode: AccessMode,
  ): Promise<void> {
    if (isStaffUser(auth)) {
      return;
    }
    const teacherId = await this.users.getTeacherId(bearerToken);
    if (teacherId && lesson.teacherId === teacherId) {
      return;
    }
    if (mode === 'teacher-write') {
      throw new ForbiddenException('Assigned teacher or staff access required');
    }
    const studentId = await this.users.getStudentId(bearerToken);
    const hasAnyAccess = lesson.studentAccesses.some((row) => row.studentId === studentId);
    const hasPaidAccess = lesson.studentAccesses.some((row) => row.studentId === studentId && row.isPaid);
    if (studentId && hasAnyAccess && mode === 'state') {
      return;
    }
    if (studentId && hasPaidAccess && mode === 'playback') {
      return;
    }
    throw new ForbiddenException('Lesson record access denied');
  }
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${name} is required`);
  }
  return value.trim();
}

function optionalInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new BadRequestException('studentId must be an integer');
  }
  return n;
}

function datePrefix(start: Date | null): string {
  const d = start ?? new Date();
  const yyyy = String(d.getUTCFullYear()).padStart(4, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

function extension(filename: string): string {
  const raw = filename.split('.').pop() || 'mp3';
  return raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'mp3';
}

function lessonKey(lessonUuid: string, start: Date | null, filename: string): string {
  return `${datePrefix(start)}/lesson_${lessonUuid}.${extension(filename)}`;
}

function partKey(partUuid: string, start: Date | null, filename: string): string {
  return `${datePrefix(start)}/parts_${partUuid}.${extension(filename)}`;
}
