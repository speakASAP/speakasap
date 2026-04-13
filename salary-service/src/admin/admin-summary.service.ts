import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalaryExpenseKind } from '@prisma/client';

@Injectable()
export class AdminSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Legacy parity: exclude rows whose comment contains `Salary` (case-sensitive per Django `contains`). */
  async summaryByProfile(dateFrom: string, dateTo: string) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const rows = await this.prisma.salaryExpense.findMany({
      where: {
        date: { gte: from, lte: to },
        NOT: { comment: { contains: 'Salary' } },
      },
      include: { profile: true },
    });
    type Agg = {
      profileId: string;
      legacyPortalUserId: number;
      qtySum: number;
      subtotals: Record<string, Record<string, number>>;
    };
    const byProfile = new Map<string, Agg>();
    for (const r of rows) {
      let a = byProfile.get(r.profileId);
      if (!a) {
        a = {
          profileId: r.profileId,
          legacyPortalUserId: r.legacyPortalUserId,
          qtySum: 0,
          subtotals: {},
        };
        byProfile.set(r.profileId, a);
      }
      const qty = Number(r.qty.toString());
      const price = Number(r.price.toString());
      a.qtySum += qty;
      const pm = r.profile.preferablePm;
      const pmKey = pm ?? 'null';
      if (!a.subtotals[pmKey]) {
        a.subtotals[pmKey] = {};
      }
      if (!a.subtotals[pmKey][r.currency]) {
        a.subtotals[pmKey][r.currency] = 0;
      }
      a.subtotals[pmKey][r.currency] += qty * price;
    }
    const grand: Record<string, number> = {};
    for (const a of byProfile.values()) {
      for (const curMap of Object.values(a.subtotals)) {
        for (const [cur, v] of Object.entries(curMap)) {
          grand[cur] = (grand[cur] ?? 0) + v;
        }
      }
    }
    return {
      dateFrom,
      dateTo,
      profiles: [...byProfile.values()],
      grandTotalsByCurrency: grand,
    };
  }

  async summaryMonths() {
    const rows = await this.prisma.salaryExpense.findMany({
      where: { kind: SalaryExpenseKind.lesson },
      select: { date: true },
    });
    const months = new Set<string>();
    for (const r of rows) {
      const d = r.date;
      months.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    return { months: [...months].sort((a, b) => b.localeCompare(a)) };
  }
}
