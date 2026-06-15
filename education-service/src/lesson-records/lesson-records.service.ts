import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { LessonRecord, LessonRecordPart } from '@prisma/client';
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
const MAX_MERGE_SIZE = 240 * 1024 * 1024;
const MAX_RECORD_DURATION_SECONDS = 6 * 60 * 60;

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
      durationSeconds: record?.durationSeconds ?? null,
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
    const bodyDurationSeconds = optionalDurationSeconds(body.durationSeconds ?? body.duration_seconds, 'durationSeconds');
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
      const durationSeconds = optionalDurationSeconds(item.durationSeconds ?? item.duration_seconds, 'item durationSeconds');
      if (!Number.isInteger(size) || size < 0 || size > MAX_RECORD_SIZE) {
        throw new BadRequestException('item size is invalid');
      }
      if (kind === 'lesson') {
        const expectedKey = lessonKey(lesson.uuid, lesson.start, filename);
        if (key !== expectedKey) {
          throw new BadRequestException('lesson key mismatch');
        }
        expectedItems.push({ kind, key, size, etag, partUuid: null, durationSeconds });
      } else if (kind === 'part') {
        const partUuid = requiredString(item.partUuid ?? item.part_uuid, 'partUuid');
        const expectedKey = partKey(partUuid, lesson.start, filename);
        if (key !== expectedKey) {
          throw new BadRequestException('part key mismatch');
        }
        expectedItems.push({ kind, key, size, etag, partUuid, durationSeconds });
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
    const recordDurationSeconds = bodyDurationSeconds ?? lessonItems[0]?.durationSeconds ?? summedDurationSeconds(partItems);
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
            durationSeconds: recordDurationSeconds,
            parts: [],
          },
          update: {
            recordKey: lessonItems[0].key,
            processed: true,
            recordUnavailable: '',
            durationSeconds: recordDurationSeconds,
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
            durationSeconds: recordDurationSeconds,
            parts: partItems.map((i) => i.partUuid),
          },
          update: {
            recordKey: null,
            processed: false,
            recordUnavailable: '',
            durationSeconds: recordDurationSeconds,
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
            durationSeconds: null,
            parts: [],
          },
          update: {
            recordKey: null,
            processed: true,
            recordUnavailable,
            durationSeconds: null,
            parts: [],
          },
        });
        await tx.lessonRecordPart.deleteMany({ where: { lessonRecordUuid: recordUuid } });
      }
    });
    return { status: 'ok', lessonRecordUuid: recordUuid, durationSeconds: recordDurationSeconds };
  }

  async requestMerge(lessonUuid: string, auth: AuthContextUser, bearerToken: string, body: Record<string, unknown>) {
    const { lesson, record } = await this.loadLessonAndRecord(lessonUuid);
    await this.assertDomainAccess(lesson, auth, bearerToken, 'teacher-write');
    if (!record) {
      return { status: 'noop', reason: 'missing_record', lessonUuid };
    }
    const state = recordState(record);
    if (state === 'ready' && record.recordKey) {
      return { status: 'noop', reason: 'already_ready', lessonUuid, lessonRecordUuid: record.uuid, state, recordKey: 'private' };
    }
    const confirmMerge = requiredString(body.confirmMerge ?? body.confirm_merge, 'confirmMerge');
    if (confirmMerge !== lessonUuid) {
      throw new BadRequestException('confirmMerge must match lessonUuid');
    }
    const mergedDurationSeconds = optionalDurationSeconds(body.durationSeconds ?? body.duration_seconds, 'durationSeconds');
    const parts = await this.loadRecordParts(record.uuid, partsArray(record.parts));
    if (parts.length === 0) {
      return { status: 'noop', reason: 'no_parts', lessonUuid, lessonRecordUuid: record.uuid, state };
    }
    const partBuffers: Buffer[] = [];
    const sourceKeys: string[] = [];
    let totalSize = 0;
    for (const part of parts) {
      assertMp3Key(part.partKey);
      const object = await this.storage.getObjectBuffer(part.partKey);
      if (object.size <= 0) {
        throw new BadRequestException('Lesson record part object is empty');
      }
      totalSize += object.size;
      if (totalSize > MAX_MERGE_SIZE) {
        throw new BadRequestException('Merged lesson record exceeds the maximum supported size');
      }
      partBuffers.push(object.buffer);
      sourceKeys.push(object.key);
    }
    const merged = Buffer.concat(partBuffers, totalSize);
    const outputKey = lessonKey(lesson.uuid, lesson.start, 'record.mp3');
    await this.storage.putObject(outputKey, merged, 'audio/mpeg');
    const meta = await this.storage.headObject(outputKey);
    if (meta.size !== merged.length) {
      throw new ServiceUnavailableException('Merged lesson record validation failed');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.lessonRecord.update({
        where: { uuid: record.uuid },
        data: {
          recordKey: outputKey,
          processed: true,
          recordUnavailable: '',
          durationSeconds: mergedDurationSeconds ?? record.durationSeconds,
          parts: [],
        },
      });
      await tx.lessonRecordPart.deleteMany({ where: { lessonRecordUuid: record.uuid } });
    });
    const cleanup = await this.deleteStorageKeys(sourceKeys);
    return {
      status: 'merged',
      lessonUuid,
      lessonRecordUuid: record.uuid,
      recordKey: 'private',
      outputSize: meta.size,
      partsMerged: parts.length,
      sourcePartsDeleted: cleanup.deleted.length,
      sourcePartDeleteFailures: cleanup.failed.length,
      durationSeconds: mergedDurationSeconds ?? record.durationSeconds,
    };
  }

  async deleteRecord(lessonUuid: string, auth: AuthContextUser, bearerToken: string, body: Record<string, unknown>) {
    const { lesson, record } = await this.loadLessonAndRecord(lessonUuid);
    await this.assertDomainAccess(lesson, auth, bearerToken, 'teacher-write');
    if (!record) {
      return { status: 'noop', reason: 'missing_record', lessonUuid };
    }
    const confirmDelete = requiredString(body.confirmDelete ?? body.confirm_delete, 'confirmDelete');
    if (confirmDelete !== lessonUuid) {
      throw new BadRequestException('confirmDelete must match lessonUuid');
    }
    const parts = await this.loadRecordParts(record.uuid, partsArray(record.parts));
    const storageKeys = uniqueStrings([record.recordKey, ...parts.map((part) => part.partKey)]);
    await this.prisma.$transaction(async (tx) => {
      await tx.lessonRecordPart.deleteMany({ where: { lessonRecordUuid: record.uuid } });
      await tx.lessonRecord.delete({ where: { uuid: record.uuid } });
    });
    const cleanup = await this.deleteStorageKeys(storageKeys);
    return {
      status: 'deleted',
      lessonUuid,
      lessonRecordUuid: record.uuid,
      metadataDeleted: true,
      objectsAttempted: cleanup.attempted.length,
      objectsDeleted: cleanup.deleted.length,
      objectDeleteFailures: cleanup.failed.length,
    };
  }

  private async loadRecordParts(recordUuid: string, jsonPartIds: string[]): Promise<LessonRecordPart[]> {
    const directParts = await this.prisma.lessonRecordPart.findMany({
      where: { lessonRecordUuid: recordUuid },
      orderBy: [{ createdAt: 'asc' }, { uuid: 'asc' }],
    });
    if (directParts.length > 0 || jsonPartIds.length === 0) {
      return directParts;
    }
    return this.prisma.lessonRecordPart.findMany({
      where: { uuid: { in: jsonPartIds } },
      orderBy: [{ createdAt: 'asc' }, { uuid: 'asc' }],
    });
  }

  private async deleteStorageKeys(keys: string[]) {
    const attempted: string[] = [];
    const deleted: string[] = [];
    const failed: string[] = [];
    for (const key of uniqueStrings(keys)) {
      const result = await this.storage.deleteObjectCandidates(key);
      attempted.push(...result.attempted);
      deleted.push(...result.deleted);
      failed.push(...result.failed);
    }
    return { attempted, deleted, failed };
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

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => (value || '').trim()).filter(Boolean)));
}

function assertMp3Key(key: string): void {
  if (!key.toLowerCase().endsWith('.mp3')) {
    throw new BadRequestException('Only MP3 lesson record parts can be merged by the target runtime');
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

function optionalDurationSeconds(value: unknown, name: string): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_RECORD_DURATION_SECONDS) {
    throw new BadRequestException(`${name} must be an integer between 0 and ${MAX_RECORD_DURATION_SECONDS}`);
  }
  return n;
}

function summedDurationSeconds(items: Array<{ durationSeconds: number | null }>): number | null {
  if (!items.length || items.some((item) => item.durationSeconds === null)) {
    return null;
  }
  return items.reduce((total, item) => total + (item.durationSeconds ?? 0), 0);
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
