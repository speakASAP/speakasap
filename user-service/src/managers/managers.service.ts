import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Manager, type UserIdentityMirror } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContextUser } from '../shared/auth.types';
import { buildAvatarUrl } from '../shared/avatar-url.util';

@Injectable()
export class ManagersService {
  constructor(private readonly prisma: PrismaService) {}

  toManagerProfile(
    row: Manager,
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
      description: row.description,
      position: row.position,
      contractName: row.contractName,
      passportNumber: row.passportNumber,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      addressCz: row.addressCz,
      cityCz: row.cityCz,
    };
  }

  async getMe(auth: AuthContextUser): Promise<Record<string, unknown>> {
    const row = await this.prisma.manager.findUnique({ where: { authUserId: auth.id } });
    if (!row) {
      throw new NotFoundException('Manager profile not found');
    }
    const mirror = await this.prisma.userIdentityMirror.findUnique({
      where: { authUserId: auth.id },
    });
    return this.toManagerProfile(row, mirror, auth);
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
      const data: Prisma.ManagerCreateInput = {
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
      };
      await this.prisma.manager.upsert({
        where: { authUserId },
        create: data,
        update: {
          legacyPortalUserId: legacyPortalUserId ?? undefined,
          description: data.description ?? undefined,
          position: data.position,
          contractName: data.contractName,
          passportNumber: data.passportNumber,
          address: data.address,
          postalCode: data.postalCode,
          city: data.city,
          addressCz: data.addressCz,
          cityCz: data.cityCz,
        },
      });
      upserted += 1;
    }
    return { upserted };
  }
}
