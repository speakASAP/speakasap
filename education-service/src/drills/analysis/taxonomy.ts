import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The grammar taxonomy the analyzer is allowed to cluster into.
 *
 * Stable slugs are the point. A model asked to name a gap freely will name the same gap
 * three different ways across three assignments, which makes "which gaps does this student
 * keep failing" unanswerable. Constraining the model to this list is what makes the gap a
 * durable fact about the student rather than a sentence in one report.
 */
@Injectable()
export class TaxonomyService {
  private readonly logger = new Logger(TaxonomyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every slug for a language, in display order.
   *
   * Raises rather than returning `[]` when a language has no taxonomy: an empty allow-list
   * would make every cluster invalid and silently push the whole analysis into the
   * fallback bucket, which reads as "the model is useless" instead of "this language was
   * never seeded".
   */
  async slugsFor(languageCode: string): Promise<string[]> {
    const rows: any[] = await (this.prisma as any).grammarTopic.findMany({
      where: { languageCode },
      orderBy: { sortOrder: 'asc' },
    });

    if (rows.length === 0) {
      throw new Error(
        `No grammar taxonomy seeded for language "${languageCode}" — run prisma/seed-grammar-topics.ts`,
      );
    }

    return rows.map((row) => row.slug as string);
  }

  /** The bucket an unrecognised cluster lands in. Seeded for every language. */
  fallbackSlug(languageCode: string): string {
    return `${languageCode}.other`;
  }

  /**
   * Forces a model-proposed slug into the taxonomy.
   *
   * A coerced slug is logged at **warn** with the original value by the caller, so the
   * taxonomy grows from what the model actually keeps reaching for rather than from
   * guesswork. Silently absorbing everything into `other` would hide that signal.
   */
  coerceSlug(
    candidate: string,
    allowed: string[],
    languageCode: string,
  ): { slug: string; coerced: boolean } {
    const trimmed = (candidate ?? '').trim();
    if (trimmed && allowed.includes(trimmed)) {
      return { slug: trimmed, coerced: false };
    }
    return { slug: this.fallbackSlug(languageCode), coerced: true };
  }

  /** A topic's display title, in the student's material language. */
  async titleFor(slug: string, materialLanguage: string): Promise<string | null> {
    const row: any = await (this.prisma as any).grammarTopic.findUnique({ where: { slug } });
    if (!row) {
      return null;
    }
    const titles = (row.titles ?? {}) as Record<string, string>;
    return titles[materialLanguage] ?? titles.en ?? null;
  }
}
