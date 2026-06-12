import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { LessonRecord } from '@prisma/client';
import type { Response } from 'express';
import type { AuthContextUser } from '../shared/auth.types';
import { isStaffUser } from '../shared/staff-access';
import { PrismaService } from '../prisma/prisma.service';
import { LessonRecordMediaTokenService } from './media-token.service';
import { LessonRecordStorageService } from './storage.service';
import { UserProfilesClient } from './user-profiles.client';

type AccessMode = 'state' | 'playback' | 'teacher-write';

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

  async presignUpload(lessonUuid: string, auth: AuthContextUser, bearerToken: string): Promise<never> {
    const { lesson } = await this.loadLessonAndRecord(lessonUuid);
    await this.assertDomainAccess(lesson, auth, bearerToken, 'teacher-write');
    throw new ServiceUnavailableException('Private upload presign is not implemented in education-service yet');
  }

  async commitUpload(lessonUuid: string, auth: AuthContextUser, bearerToken: string): Promise<never> {
    const { lesson } = await this.loadLessonAndRecord(lessonUuid);
    await this.assertDomainAccess(lesson, auth, bearerToken, 'teacher-write');
    throw new ServiceUnavailableException('Private upload commit is not implemented in education-service yet');
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
    const isGroupStudent = lesson.studentCourse.group.groupStudents.some((row) => row.studentId === studentId);
    if (studentId && isGroupStudent && mode === 'state') {
      return;
    }
    if (studentId && isGroupStudent && mode === 'playback') {
      throw new ForbiddenException('Student paid lesson-record access is not implemented in target data yet');
    }
    throw new ForbiddenException('Lesson record access denied');
  }
}
