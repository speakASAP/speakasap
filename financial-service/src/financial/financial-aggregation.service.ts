import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CourseClientService } from '../deps/course-client.service';
import { PaymentClientService, type PaidOrderRow, type TransactionsRow } from '../deps/payment-client.service';
import { SalaryClientService } from '../deps/salary-client.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertMonthRangeBounded,
  firstOfMonthUtc,
  iterMonthsInclusive,
  lastInstantOfMonthUtc,
} from '../shared/months';
import { minorFromTotalsString } from '../shared/money-parse';

type CatAgg = {
  totalMinor: number;
  currency: string;
  legacyCategoryId: number | null;
  titleSnapshot: string | null;
};

type MethodAgg = {
  totalMinor: number;
  currency: string;
};

@Injectable()
export class FinancialAggregationService {
  private readonly logger = new Logger(FinancialAggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentClient: PaymentClientService,
    private readonly salaryClient: SalaryClientService,
    private readonly courseClient: CourseClientService,
  ) {}

  displayCurrency(): string {
    return process.env.FINANCIAL_DISPLAY_CURRENCY || 'CZK';
  }

  async refreshWindow(monthFrom: string, monthTo: string): Promise<{ months: number; durationMs: number }> {
    const started = Date.now();
    assertMonthRangeBounded(monthFrom, monthTo, 36);
    const months = iterMonthsInclusive(monthFrom, monthTo);
    const monthSet = new Set(months);
    const display = this.displayCurrency();

    try {
      const monthDates = months.map((m) => firstOfMonthUtc(m));
      await this.prisma.monthlyRevenueByCategory.deleteMany({
        where: { periodMonth: { in: monthDates } },
      });
      await this.prisma.monthlyRevenueByMethod.deleteMany({
        where: { periodMonth: { in: monthDates } },
      });

      for (const month of months) {
        const isoMonth = `${month}-01`;
        this.logger.log(`${new Date().toISOString()} salary refresh month=${month}`);
        const salary = await this.salaryClient.fetchPeriodSalaryTotals(month);
        await this.prisma.salaryPeriodTotalCache.upsert({
          where: { month: firstOfMonthUtc(month) },
          create: {
            month: firstOfMonthUtc(month),
            currencyTotals: salary.currencyTotals as Prisma.InputJsonValue,
            lineCount: salary.lineCount,
            periodStart: salary.periodStart,
            periodEnd: salary.periodEnd,
          },
          update: {
            currencyTotals: salary.currencyTotals as Prisma.InputJsonValue,
            lineCount: salary.lineCount,
            periodStart: salary.periodStart,
            periodEnd: salary.periodEnd,
            fetchedAt: new Date(),
          },
        });
      }

      const paidAfter = firstOfMonthUtc(monthFrom).toISOString();
      const paidBefore = lastInstantOfMonthUtc(monthTo).toISOString();

      const catMap = new Map<string, CatAgg>();
      const methodMap = new Map<string, MethodAgg>();
      const productIds = new Set<number>();

      let cursor: string | undefined;
      const limit = 30;
      do {
        this.logger.log(`${new Date().toISOString()} payment orders-paid-slice scan ids cursor=${cursor ?? 'null'}`);
        const slice = await this.paymentClient.fetchOrdersPaidSlice({
          paidAfter,
          paidBefore,
          cursor,
          limit,
        });
        for (const row of slice.data) {
          if (row.legacyProductId != null) {
            productIds.add(row.legacyProductId);
          }
        }
        cursor = slice.meta.nextCursor ?? undefined;
      } while (cursor);

      const metaByProduct = await this.resolveProductMetadata([...productIds]);
      await this.replayOrdersWithMeta(paidAfter, paidBefore, monthSet, catMap, methodMap, display, metaByProduct);

      await this.persistCategoryRows(months, catMap);
      await this.persistMethodRows(months, methodMap);
      await this.syncCategorySnapshots(metaByProduct);

      await this.ingestTransactions(monthFrom, monthTo);
      await this.recomputeRollups(months, display);

      await this.prisma.financialSyncState.upsert({
        where: { id: 'default' },
        create: { id: 'default', lastRefreshAt: new Date(), lastRefreshError: null },
        update: { lastRefreshAt: new Date(), lastRefreshError: null },
      });

      const durationMs = Date.now() - started;
      this.logger.log(`${new Date().toISOString()} refresh-window done months=${months.length} duration_ms=${durationMs}`);
      return { months: months.length, durationMs };
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.error(`${new Date().toISOString()} refresh-window failed ${msg}`);
      await this.prisma.financialSyncState.upsert({
        where: { id: 'default' },
        create: { id: 'default', lastRefreshAt: null, lastRefreshError: msg },
        update: { lastRefreshError: msg },
      });
      if (e instanceof HttpException) {
        throw e;
      }
      throw new HttpException(
        {
          error: {
            code: 'DEPENDENCY_UNAVAILABLE',
            message: msg,
            details: {},
          },
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async replayOrdersWithMeta(
    paidAfter: string,
    paidBefore: string,
    monthSet: Set<string>,
    catMap: Map<string, CatAgg>,
    methodMap: Map<string, MethodAgg>,
    display: string,
    metaByProduct: Map<number, { legacyCategoryId: number; title: string; enTitle: string }>,
  ): Promise<void> {
    let cursor: string | undefined;
    const limit = 30;
    do {
      const slice = await this.paymentClient.fetchOrdersPaidSlice({
        paidAfter,
        paidBefore,
        cursor,
        limit,
      });
      for (const row of slice.data) {
        const meta = row.legacyProductId != null ? metaByProduct.get(row.legacyProductId) ?? null : null;
        this.accumulateOrder(row, monthSet, catMap, methodMap, display, meta);
      }
      cursor = slice.meta.nextCursor ?? undefined;
    } while (cursor);
  }

  private accumulateOrder(
    row: PaidOrderRow,
    monthSet: Set<string>,
    catMap: Map<string, CatAgg>,
    methodMap: Map<string, MethodAgg>,
    display: string,
    meta: { legacyCategoryId: number; title: string; enTitle: string } | null,
  ): void {
    const paid = new Date(row.paidAt);
    const month = `${paid.getUTCFullYear()}-${String(paid.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!monthSet.has(month)) {
      return;
    }
    const legacyCategoryId = meta?.legacyCategoryId ?? null;
    const categoryKey = legacyCategoryId === null ? 'uncategorized' : String(legacyCategoryId);
    const catKey = `${month}|${categoryKey}`;
    const cur = catMap.get(catKey);
    const titleSnapshot = meta?.title ?? null;
    const rowCurrency = row.currency || display;
    if (!cur) {
      catMap.set(catKey, {
        totalMinor: row.priceMinor,
        currency: rowCurrency,
        legacyCategoryId,
        titleSnapshot,
      });
    } else {
      cur.totalMinor += row.priceMinor;
      if (!cur.titleSnapshot && titleSnapshot) {
        cur.titleSnapshot = titleSnapshot;
      }
    }

    const rawMethod = row.paymentMethodKey === undefined || row.paymentMethodKey === null ? '' : String(row.paymentMethodKey);
    const methodKeyRaw = rawMethod === '' ? '__null__' : rawMethod;
    const mKey = `${month}|${methodKeyRaw}`;
    const mcur = methodMap.get(mKey);
    const mCurrency = row.currency || display;
    if (!mcur) {
      methodMap.set(mKey, { totalMinor: row.priceMinor, currency: mCurrency });
    } else {
      mcur.totalMinor += row.priceMinor;
    }
  }

  private async resolveProductMetadata(
    productIds: number[],
  ): Promise<Map<number, { legacyCategoryId: number; title: string; enTitle: string }>> {
    const out = new Map<number, { legacyCategoryId: number; title: string; enTitle: string }>();
    for (let i = 0; i < productIds.length; i += 30) {
      const batch = productIds.slice(i, i + 30);
      if (batch.length === 0) {
        continue;
      }
      try {
        const res = await this.courseClient.fetchProductsMetadata(batch);
        for (const it of res.items) {
          out.set(it.legacyProductId, {
            legacyCategoryId: it.legacyCategoryId,
            title: it.title,
            enTitle: it.enTitle,
          });
        }
      } catch (e) {
        this.logger.warn(`${new Date().toISOString()} course metadata batch failed ${(e as Error).message}`);
      }
    }
    return out;
  }

  private async persistCategoryRows(months: string[], catMap: Map<string, CatAgg>): Promise<void> {
    const monthSet = new Set(months);
    const rows: Prisma.MonthlyRevenueByCategoryCreateManyInput[] = [];
    for (const [key, v] of catMap) {
      const [month, categoryKey] = key.split('|');
      if (!monthSet.has(month)) {
        continue;
      }
      rows.push({
        periodMonth: firstOfMonthUtc(month),
        categoryKey,
        legacyCategoryId: v.legacyCategoryId,
        totalMinor: v.totalMinor,
        currency: v.currency,
        titleSnapshot: v.titleSnapshot,
      });
    }
    if (rows.length > 0) {
      await this.prisma.monthlyRevenueByCategory.createMany({ data: rows });
    }
  }

  private async persistMethodRows(months: string[], methodMap: Map<string, MethodAgg>): Promise<void> {
    const monthSet = new Set(months);
    const rows: Prisma.MonthlyRevenueByMethodCreateManyInput[] = [];
    for (const [key, v] of methodMap) {
      const [month, methodKeyRaw] = key.split('|');
      if (!monthSet.has(month)) {
        continue;
      }
      rows.push({
        periodMonth: firstOfMonthUtc(month),
        methodKeyRaw,
        totalMinor: v.totalMinor,
        currency: v.currency,
      });
    }
    if (rows.length > 0) {
      await this.prisma.monthlyRevenueByMethod.createMany({ data: rows });
    }
  }

  private async syncCategorySnapshots(
    metaByProduct: Map<number, { legacyCategoryId: number; title: string; enTitle: string }>,
  ): Promise<void> {
    const byCat = new Map<number, { title: string }>();
    for (const m of metaByProduct.values()) {
      if (!byCat.has(m.legacyCategoryId)) {
        byCat.set(m.legacyCategoryId, { title: m.title });
      }
    }
    for (const [legacyCategoryId, v] of byCat) {
      await this.prisma.categoryAxisSnapshot.upsert({
        where: { legacyCategoryId },
        create: {
          legacyCategoryId,
          title: v.title,
          productForOffers: false,
        },
        update: { title: v.title, syncedAt: new Date() },
      });
    }
  }

  private async ingestTransactions(monthFrom: string, monthTo: string): Promise<void> {
    const createdAfter = firstOfMonthUtc(monthFrom).toISOString();
    const createdBefore = lastInstantOfMonthUtc(monthTo).toISOString();
    let cursor: string | undefined;
    const limit = 30;
    do {
      this.logger.log(`${new Date().toISOString()} payment transactions-slice cursor=${cursor ?? 'null'}`);
      const slice = await this.paymentClient.fetchTransactionsSlice({
        cursor,
        limit,
        createdAfter,
        createdBefore,
      });
      for (const row of slice.data) {
        await this.upsertLedger(row);
      }
      cursor = slice.meta.nextCursor ?? undefined;
    } while (cursor);
  }

  private async upsertLedger(row: TransactionsRow): Promise<void> {
    const legacyTransactionId = row.legacyTransactionId ?? (row as { id?: number }).id;
    if (legacyTransactionId == null || Number.isNaN(Number(legacyTransactionId))) {
      return;
    }
    const currency = row.currency || this.displayCurrency();
    await this.prisma.ledgerLine.upsert({
      where: { legacyTransactionId },
      create: {
        legacyTransactionId,
        legacyPortalUserId: row.legacyUserId,
        amountMinor: row.amountMinor,
        isIncome: row.isIncome,
        legacyOrderId: row.legacyOrderId ?? null,
        comment: '',
        external: row.external ?? false,
        currency,
        createdAt: new Date(row.createdAt),
        source: 'ledger_transaction',
      },
      update: {
        amountMinor: row.amountMinor,
        isIncome: row.isIncome,
        legacyOrderId: row.legacyOrderId ?? null,
        external: row.external ?? false,
        currency,
        createdAt: new Date(row.createdAt),
      },
    });
  }

  private async recomputeRollups(months: string[], display: string): Promise<void> {
    for (const month of months) {
      const d = firstOfMonthUtc(month);
      const start = firstOfMonthUtc(month);
      const end = lastInstantOfMonthUtc(month);
      const cats = await this.prisma.monthlyRevenueByCategory.findMany({
        where: { periodMonth: d },
      });
      let totalPaid = 0;
      let currency = display;
      for (const c of cats) {
        if (c.currency === display) {
          totalPaid += c.totalMinor;
          currency = c.currency;
        }
      }
      if (cats.length > 0 && totalPaid === 0) {
        totalPaid = cats.reduce((s, c) => s + c.totalMinor, 0);
        currency = cats[0]?.currency || display;
      }

      const ledgers = await this.prisma.ledgerLine.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          legacyOrderId: null,
        },
      });
      let totalTransactionsNet = 0;
      let operatingExpenseLedger = 0;
      for (const L of ledgers) {
        const signed = L.isIncome ? L.amountMinor : -L.amountMinor;
        totalTransactionsNet += signed;
        if (!L.isIncome) {
          operatingExpenseLedger += L.amountMinor;
        }
      }

      await this.prisma.monthlyFinancialRollup.upsert({
        where: { periodMonth: d },
        create: {
          periodMonth: d,
          totalPaidOrdersMinor: totalPaid,
          totalTransactionsNetMinor: totalTransactionsNet,
          currency,
          operatingExpenseLedgerMinor: operatingExpenseLedger,
        },
        update: {
          totalPaidOrdersMinor: totalPaid,
          totalTransactionsNetMinor: totalTransactionsNet,
          currency,
          operatingExpenseLedgerMinor: operatingExpenseLedger,
        },
      });
    }
  }
}
