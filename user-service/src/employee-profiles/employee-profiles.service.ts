import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContextUser } from '../shared/auth.types';

const PATCH_KEYS = new Set(['additionalInfo', 'description', 'position']);

@Injectable()
export class EmployeeProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(auth: AuthContextUser): Promise<Record<string, unknown>> {
    const row = await this.prisma.employeeProfile.findUnique({ where: { authUserId: auth.id } });
    if (!row) {
      throw new NotFoundException('Employee profile not found');
    }
    return {
      id: row.id,
      authUserId: row.authUserId,
      additionalInfo: row.additionalInfo,
      description: row.description,
      position: row.position,
    };
  }

  async patchMe(auth: AuthContextUser, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const row = await this.prisma.employeeProfile.findUnique({ where: { authUserId: auth.id } });
    if (!row) {
      throw new NotFoundException('Employee profile not found');
    }
    const data: Prisma.EmployeeProfileUpdateInput = {};
    for (const [key, val] of Object.entries(body)) {
      if (val === undefined || !PATCH_KEYS.has(key)) {
        continue;
      }
      if (key === 'additionalInfo') {
        data.additionalInfo = val === null ? null : String(val);
      } else if (key === 'description') {
        data.description = val === null ? null : String(val);
      } else if (key === 'position') {
        data.position = val === null ? null : String(val);
      }
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }
    try {
      const updated = await this.prisma.employeeProfile.update({
        where: { id: row.id },
        data,
      });
      return {
        id: updated.id,
        authUserId: updated.authUserId,
        additionalInfo: updated.additionalInfo,
        description: updated.description,
        position: updated.position,
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Unique constraint violation');
      }
      throw e;
    }
  }
}
