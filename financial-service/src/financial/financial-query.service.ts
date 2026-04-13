import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertMonthRangeBounded,
  assertValidMonth,
  firstOfMonthUtc,
  iterMonthsInclusive,
  lastInstantOfMonthUtc,
} from '../shared/months';
import { minorFromTotalsString } from '../shared/money-parse';
import {
  decodeCursor,
  encodeCursor,
  parseListLimit,
  type ListEnvelope,
} from '../shared/list-response';

@Injectable()
export class FinancialQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private displayCurrency(): string {
    return process.env.FINANCIAL_DISPLAY_CURRENCY || 'CZK';
  }

  private async asOf(): Promise<string> {
    const st = await this.prisma.financialSyncState.findUnique({ where: { id: 'default' } });
    return (st?.lastRefreshAt ?? new Date()).toISOString();
  }

  async categoryMatrix(monthFrom: string, monthTo: string) {
    assertMonthRangeBounded(monthFrom, monthTo, 36);
    const months = iterMonthsInclusive(monthFrom, monthTo);
    const monthDates = months.map((m) => firstOfMonthUtc(m));
    const display = this.displayCurrency();

    const rows = await this.prisma.monthlyRevenueByCategory.findMany({
      where: {
        periodMonth: { in: monthDates },
        currency: display,
      },
    });

    const catKeys = [...new Set(rows.map((r) => r.categoryKey))].sort((a, b) => {
      if (a === 'uncategorized') {
        return 1;
      }
      if (b === 'uncategorized') {
        return -1;
      }
      return Number(a) - Number(b);
    });

    const categories = await Promise.all(
      catKeys.map(async (ck) => {
        const legacyCategoryId = ck === 'uncategorized' ? null : Number(ck);
        let title = '';
        let productForOffers = false;
        if (legacyCategoryId != null) {
          const snap = await this.prisma.categoryAxisSnapshot.findUnique({
            where: { legacyCategoryId },
          });
          title = snap?.title ?? rows.find((r) => r.categoryKey === ck)?.titleSnapshot ?? `Category ${ck}`;
          productForOffers = snap?.productForOffers ?? false;
        } else {
          title = 'Uncategorized';
        }
        return { legacyCategoryId, title, productForOffers };
      }),
    );

    const monthsIso = months.map((m) => `${m}-01`);
    const cells: number[][] = categories.map((_, ri) =>
      months.map((mo) => {
        const r = rows.find((x) => x.categoryKey === catKeys[ri] && x.periodMonth.getTime() === firstOfMonthUtc(mo).getTime());
        return r?.totalMinor ?? 0;
      }),
    );

    const grandTotalsByMonth = months.map((_, mi) =>
      categories.reduce((sum, __, ri) => sum + (cells[ri][mi] ?? 0), 0),
    );

    return {
      months: monthsIso,
      categories,
      cells,
      grandTotalsByMonth,
      asOf: await this.asOf(),
      source: 'live' as const,
    };
  }

  async revenueByPaymentMethod(month: string) {
    assertValidMonth(month, 'month');
    const display = this.displayCurrency();
    const rows = await this.prisma.monthlyRevenueByMethod.findMany({
      where: { periodMonth: firstOfMonthUtc(month), currency: display },
      orderBy: { methodKeyRaw: 'asc' },
    });
    const mapped = rows.map((r) => ({
      methodKey: r.methodKeyRaw === '__null__' ? null : r.methodKeyRaw,
      methodLabel: methodLabel(r.methodKeyRaw),
      totalMinor: r.totalMinor,
    }));
    const totalMinor = mapped.reduce((s, r) => s + r.totalMinor, 0);
    return {
      month,
      rows: mapped,
      totalMinor,
      asOf: await this.asOf(),
      source: 'live' as const,
    };
  }

  async revenueSummary(monthFrom: string, monthTo: string) {
    assertMonthRangeBounded(monthFrom, monthTo, 36);
    const months = iterMonthsInclusive(monthFrom, monthTo);
    const periods = [];
    for (const month of months) {
      const r = await this.prisma.monthlyFinancialRollup.findUnique({
        where: { periodMonth: firstOfMonthUtc(month) },
      });
      periods.push({
        month,
        totalPaidOrdersMinor: r?.totalPaidOrdersMinor ?? 0,
        totalTransactionsNetMinor: r?.totalTransactionsNetMinor ?? 0,
      });
    }
    return { periods, asOf: await this.asOf(), source: 'live' as const };
  }

  async expensesSummary(monthFrom: string, monthTo: string) {
    assertMonthRangeBounded(monthFrom, monthTo, 36);
    const months = iterMonthsInclusive(monthFrom, monthTo);
    const display = this.displayCurrency();
    const periods = [];
    for (const month of months) {
      const rollup = await this.prisma.monthlyFinancialRollup.findUnique({
        where: { periodMonth: firstOfMonthUtc(month) },
      });
      const opLines = await this.prisma.operatingExpenseLine.aggregate({
        where: {
          date: {
            gte: firstOfMonthUtc(month),
            lte: lastInstantOfMonthUtc(month),
          },
          currency: display,
        },
        _sum: { amountMinor: true },
      });
      const operatingLinesMinor = opLines._sum.amountMinor ?? 0;
      const operatingMinor = operatingLinesMinor + (rollup?.operatingExpenseLedgerMinor ?? 0);

      const sal = await this.prisma.salaryPeriodTotalCache.findUnique({
        where: { month: firstOfMonthUtc(month) },
      });
      const totals = (sal?.currencyTotals as Record<string, string> | null) ?? {};
      const salaryMinor = minorFromTotalsString(totals[display]);

      periods.push({
        month,
        operatingMinor,
        salaryMinor,
        currency: display,
      });
    }
    return { periods, asOf: await this.asOf(), source: 'live' as const };
  }

  async operatingLines(cursor?: string, limitRaw?: string): Promise<ListEnvelope<Record<string, unknown>>> {
    const limit = parseListLimit(limitRaw);
    const decoded = decodeCursor(cursor);
    const take = limit + 1;
    const rows = await this.prisma.operatingExpenseLine.findMany({
      take,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      where: decoded
        ? {
            OR: [
              { date: { lt: new Date(decoded.t) } },
              {
                AND: [{ date: new Date(decoded.t) }, { id: { lt: decoded.id } }],
              },
            ],
          }
        : undefined,
    });
    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ t: last.date.toISOString().slice(0, 10), id: last.id })
        : null;
    return {
      data: page.map((r) => ({
        id: r.id,
        comment: r.comment,
        amountMinor: r.amountMinor,
        date: r.date.toISOString().slice(0, 10),
        currency: r.currency,
      })),
      meta: { nextCursor, limit },
    };
  }

  async dashboardOverview(month: string) {
    assertValidMonth(month, 'month');
    const display = this.displayCurrency();
    const cur = await this.prisma.monthlyFinancialRollup.findUnique({
      where: { periodMonth: firstOfMonthUtc(month) },
    });
    const prevMonth = previousYm(month);
    const prev = await this.prisma.monthlyFinancialRollup.findUnique({
      where: { periodMonth: firstOfMonthUtc(prevMonth) },
    });

    const opLines = await this.prisma.operatingExpenseLine.aggregate({
      where: {
        date: { gte: firstOfMonthUtc(month), lte: lastInstantOfMonthUtc(month) },
        currency: display,
      },
      _sum: { amountMinor: true },
    });
    const operatingLinesMinor = opLines._sum.amountMinor ?? 0;
    const operatingLedger = cur?.operatingExpenseLedgerMinor ?? 0;
    const expenseOperatingMinor = operatingLinesMinor + operatingLedger;

    const sal = await this.prisma.salaryPeriodTotalCache.findUnique({
      where: { month: firstOfMonthUtc(month) },
    });
    const totals = (sal?.currencyTotals as Record<string, string> | null) ?? {};
    const expenseSalaryMinor = minorFromTotalsString(totals[display]);

    const revenueMinor = cur?.totalPaidOrdersMinor ?? 0;
    const netMinor = revenueMinor - expenseOperatingMinor - expenseSalaryMinor;

    let revenueChangePct: number | null = null;
    let expenseChangePct: number | null = null;
    if (prev) {
      const prevRev = prev.totalPaidOrdersMinor;
      const prevSal = await this.prisma.salaryPeriodTotalCache.findUnique({
        where: { month: firstOfMonthUtc(prevMonth) },
      });
      const prevTotals = (prevSal?.currencyTotals as Record<string, string> | null) ?? {};
      const prevSalary = minorFromTotalsString(prevTotals[display]);
      const prevOpLines = await this.prisma.operatingExpenseLine.aggregate({
        where: {
          date: { gte: firstOfMonthUtc(prevMonth), lte: lastInstantOfMonthUtc(prevMonth) },
          currency: display,
        },
        _sum: { amountMinor: true },
      });
      const prevOp = (prevOpLines._sum.amountMinor ?? 0) + (prev.operatingExpenseLedgerMinor ?? 0);
      const prevExp = prevOp + prevSalary;
      const curExp = expenseOperatingMinor + expenseSalaryMinor;
      if (prevRev > 0) {
        revenueChangePct = (revenueMinor - prevRev) / prevRev;
      }
      if (prevExp > 0) {
        expenseChangePct = (curExp - prevExp) / prevExp;
      }
    }

    return {
      revenueMinor,
      expenseOperatingMinor,
      expenseSalaryMinor,
      netMinor,
      currency: display,
      revenueChangePct,
      expenseChangePct,
      asOf: await this.asOf(),
      source: 'live' as const,
    };
  }
}

function methodLabel(methodKeyRaw: string): string {
  if (methodKeyRaw === '__null__' || methodKeyRaw === '') {
    return 'карта';
  }
  if (methodKeyRaw === 'paypal') {
    return 'PayPal';
  }
  if (methodKeyRaw === 'invoice') {
    return 'invoice';
  }
  return methodKeyRaw;
}

function previousYm(month: string): string {
  const d = firstOfMonthUtc(month);
  d.setUTCMonth(d.getUTCMonth() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
