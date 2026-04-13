import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, EmployeeContract } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  decodeCursor,
  encodeCursor,
  ListEnvelope,
  parseListLimit,
} from '../shared/list-response';

function mapContract(c: EmployeeContract) {
  return {
    id: c.id,
    legacyPortalUserId: c.legacyPortalUserId,
    profileId: c.profileId ?? undefined,
    validFrom: c.validFrom ? c.validFrom.toISOString().slice(0, 10) : null,
    validTill: c.validTill ? c.validTill.toISOString().slice(0, 10) : null,
    verified: c.verified,
    mainContractId: c.mainContractId ?? undefined,
    contractUid: c.contractUid ?? undefined,
    documentStorageKey: c.documentStorageKey ?? undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function mergeCursor(
  base: Prisma.EmployeeContractWhereInput,
  cur: { t: string; id: string } | null,
): Prisma.EmployeeContractWhereInput {
  if (!cur) {
    return base;
  }
  const c: Prisma.EmployeeContractWhereInput = {
    OR: [
      { createdAt: { lt: new Date(cur.t) } },
      { AND: [{ createdAt: { equals: new Date(cur.t) } }, { id: { lt: cur.id } }] },
    ],
  };
  return Object.keys(base).length ? { AND: [base, c] } : c;
}

@Injectable()
export class EmployeeContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    legacyPortalUserId?: string;
    profileId?: string;
    limit?: string;
    cursor?: string;
  }): Promise<ListEnvelope<ReturnType<typeof mapContract>>> {
    const limit = parseListLimit(params.limit);
    const cur = decodeCursor(params.cursor);
    const base: Prisma.EmployeeContractWhereInput = {};
    if (params.legacyPortalUserId) {
      base.legacyPortalUserId = Number(params.legacyPortalUserId);
    }
    if (params.profileId) {
      base.profileId = params.profileId;
    }
    const where = mergeCursor(base, cur);
    const rows = await this.prisma.employeeContract.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    let nextCursor: string | null = null;
    let data = rows;
    if (rows.length > limit) {
      data = rows.slice(0, limit);
      const last = data[data.length - 1];
      nextCursor = encodeCursor({ t: last.createdAt.toISOString(), id: last.id });
    }
    return { data: data.map(mapContract), meta: { nextCursor, limit } };
  }

  async getOne(contractId: string) {
    const c = await this.prisma.employeeContract.findUnique({ where: { id: contractId } });
    if (!c) {
      throw new NotFoundException('Contract not found');
    }
    return mapContract(c);
  }

  async create(body: {
    legacyPortalUserId: number;
    profileId?: string;
    validFrom?: string | null;
    validTill?: string | null;
    verified?: boolean;
    mainContractId?: string | null;
    contractUid?: string | null;
    documentStorageKey?: string | null;
  }) {
    const c = await this.prisma.employeeContract.create({
      data: {
        legacyPortalUserId: body.legacyPortalUserId,
        profileId: body.profileId,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validTill: body.validTill ? new Date(body.validTill) : null,
        verified: body.verified ?? false,
        mainContractId: body.mainContractId ?? undefined,
        contractUid: body.contractUid ?? undefined,
        documentStorageKey: body.documentStorageKey ?? undefined,
      },
    });
    return mapContract(c);
  }

  async patch(
    contractId: string,
    body: Partial<{
      validFrom: string | null;
      validTill: string | null;
      verified: boolean;
      mainContractId: string | null;
      contractUid: string | null;
      documentStorageKey: string | null;
    }>,
  ) {
    const existing = await this.prisma.employeeContract.findUnique({ where: { id: contractId } });
    if (!existing) {
      throw new NotFoundException('Contract not found');
    }
    const data: Prisma.EmployeeContractUpdateInput = {};
    if (body.validFrom !== undefined) {
      data.validFrom = body.validFrom ? new Date(body.validFrom) : null;
    }
    if (body.validTill !== undefined) {
      data.validTill = body.validTill ? new Date(body.validTill) : null;
    }
    if (body.verified !== undefined) {
      data.verified = body.verified;
    }
    if (body.mainContractId !== undefined) {
      data.main = body.mainContractId
        ? { connect: { id: body.mainContractId } }
        : { disconnect: true };
    }
    if (body.contractUid !== undefined) {
      data.contractUid = body.contractUid;
    }
    if (body.documentStorageKey !== undefined) {
      data.documentStorageKey = body.documentStorageKey;
    }
    const c = await this.prisma.employeeContract.update({ where: { id: contractId }, data });
    return mapContract(c);
  }
}
