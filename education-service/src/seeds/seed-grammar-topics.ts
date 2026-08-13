import { PrismaClient } from '@prisma/client';

/**
 * The grammar taxonomy the error analyzer is allowed to cluster into.
 *
 * Fixed, not runtime-editable: stable slugs are what make "which gaps does this student
 * keep failing" answerable across assignments and over time. Free-text clusters cannot be
 * compared to each other.
 *
 * Every language carries an `<lang>.other` row. The analyzer must always have a legal
 * target, so an unrecognised cluster lands there and is logged rather than dropped.
 */
export const GRAMMAR_TOPICS: Array<{
  slug: string;
  languageCode: string;
  titles: Record<string, string>;
  sortOrder: number;
}> = [
  { slug: 'en.prepositions-of-place', languageCode: 'en', sortOrder: 10,
    titles: { ru: 'Предлоги места', en: 'Prepositions of place' } },
  { slug: 'en.prepositions-of-movement', languageCode: 'en', sortOrder: 20,
    titles: { ru: 'Предлоги движения', en: 'Prepositions of movement' } },
  { slug: 'en.prepositions-of-time', languageCode: 'en', sortOrder: 30,
    titles: { ru: 'Предлоги времени', en: 'Prepositions of time' } },
  { slug: 'en.phrasal-prepositions', languageCode: 'en', sortOrder: 40,
    titles: { ru: 'Составные предлоги', en: 'Phrasal prepositions' } },
  { slug: 'en.articles', languageCode: 'en', sortOrder: 50,
    titles: { ru: 'Артикли', en: 'Articles' } },
  { slug: 'en.verb-tenses', languageCode: 'en', sortOrder: 60,
    titles: { ru: 'Времена глагола', en: 'Verb tenses' } },
  { slug: 'en.irregular-verbs', languageCode: 'en', sortOrder: 70,
    titles: { ru: 'Неправильные глаголы', en: 'Irregular verbs' } },
  { slug: 'en.word-order', languageCode: 'en', sortOrder: 80,
    titles: { ru: 'Порядок слов', en: 'Word order' } },
  { slug: 'en.pronouns', languageCode: 'en', sortOrder: 90,
    titles: { ru: 'Местоимения', en: 'Pronouns' } },
  { slug: 'en.modal-verbs', languageCode: 'en', sortOrder: 100,
    titles: { ru: 'Модальные глаголы', en: 'Modal verbs' } },
  { slug: 'en.plurals-and-countability', languageCode: 'en', sortOrder: 110,
    titles: { ru: 'Множественное число и исчисляемость', en: 'Plurals and countability' } },
  { slug: 'en.spelling', languageCode: 'en', sortOrder: 120,
    titles: { ru: 'Орфография', en: 'Spelling' } },
  { slug: 'en.vocabulary-choice', languageCode: 'en', sortOrder: 130,
    titles: { ru: 'Выбор слова', en: 'Vocabulary choice' } },
  { slug: 'en.other', languageCode: 'en', sortOrder: 999,
    titles: { ru: 'Прочее', en: 'Other' } },

  { slug: 'de.prepositions-with-cases', languageCode: 'de', sortOrder: 10,
    titles: { ru: 'Предлоги и падежи', en: 'Prepositions and cases' } },
  { slug: 'de.articles-and-gender', languageCode: 'de', sortOrder: 20,
    titles: { ru: 'Артикли и род', en: 'Articles and gender' } },
  { slug: 'de.word-order', languageCode: 'de', sortOrder: 30,
    titles: { ru: 'Порядок слов', en: 'Word order' } },
  { slug: 'de.verb-tenses', languageCode: 'de', sortOrder: 40,
    titles: { ru: 'Времена глагола', en: 'Verb tenses' } },
  { slug: 'de.separable-verbs', languageCode: 'de', sortOrder: 50,
    titles: { ru: 'Отделяемые приставки', en: 'Separable verbs' } },
  { slug: 'de.spelling', languageCode: 'de', sortOrder: 60,
    titles: { ru: 'Орфография', en: 'Spelling' } },
  { slug: 'de.vocabulary-choice', languageCode: 'de', sortOrder: 70,
    titles: { ru: 'Выбор слова', en: 'Vocabulary choice' } },
  { slug: 'de.other', languageCode: 'de', sortOrder: 999,
    titles: { ru: 'Прочее', en: 'Other' } },

  { slug: 'es.prepositions', languageCode: 'es', sortOrder: 10,
    titles: { ru: 'Предлоги', en: 'Prepositions' } },
  { slug: 'es.ser-vs-estar', languageCode: 'es', sortOrder: 20,
    titles: { ru: 'Ser и estar', en: 'Ser vs estar' } },
  { slug: 'es.verb-tenses', languageCode: 'es', sortOrder: 30,
    titles: { ru: 'Времена глагола', en: 'Verb tenses' } },
  { slug: 'es.subjunctive', languageCode: 'es', sortOrder: 40,
    titles: { ru: 'Сослагательное наклонение', en: 'Subjunctive' } },
  { slug: 'es.articles-and-gender', languageCode: 'es', sortOrder: 50,
    titles: { ru: 'Артикли и род', en: 'Articles and gender' } },
  { slug: 'es.spelling', languageCode: 'es', sortOrder: 60,
    titles: { ru: 'Орфография', en: 'Spelling' } },
  { slug: 'es.vocabulary-choice', languageCode: 'es', sortOrder: 70,
    titles: { ru: 'Выбор слова', en: 'Vocabulary choice' } },
  { slug: 'es.other', languageCode: 'es', sortOrder: 999,
    titles: { ru: 'Прочее', en: 'Other' } },
];

export async function seedGrammarTopics(prisma: PrismaClient): Promise<number> {
  for (const topic of GRAMMAR_TOPICS) {
    await prisma.grammarTopic.upsert({
      where: { slug: topic.slug },
      update: { languageCode: topic.languageCode, titles: topic.titles, sortOrder: topic.sortOrder },
      create: topic,
    });
  }
  return GRAMMAR_TOPICS.length;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedGrammarTopics(prisma)
    .then((count) => {
      // eslint-disable-next-line no-console
      console.log(`Seeded ${count} grammar topics`);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Grammar topic seed failed:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
