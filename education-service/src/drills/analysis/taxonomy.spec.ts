import { TaxonomyService } from './taxonomy';

function prismaStub(topics: Array<Record<string, unknown>>) {
  return {
    grammarTopic: {
      findMany: jest.fn(async ({ where }: any) =>
        topics.filter((t) => !where?.languageCode || t.languageCode === where.languageCode),
      ),
      findUnique: jest.fn(async ({ where }: any) =>
        topics.find((t) => t.slug === where.slug) ?? null,
      ),
    },
  };
}

const topics = [
  { slug: 'en.prepositions-of-place', languageCode: 'en', titles: { ru: 'Предлоги места', en: 'Prepositions of place' }, sortOrder: 10 },
  { slug: 'en.other', languageCode: 'en', titles: { ru: 'Прочее', en: 'Other' }, sortOrder: 999 },
];

describe('TaxonomyService.slugsFor', () => {
  it('returns the language taxonomy', async () => {
    const service = new TaxonomyService(prismaStub(topics) as any);

    expect(await service.slugsFor('en')).toEqual(['en.prepositions-of-place', 'en.other']);
  });

  it('raises when a language has no taxonomy at all', async () => {
    const service = new TaxonomyService(prismaStub([]) as any);

    await expect(service.slugsFor('fr')).rejects.toThrow(/no grammar taxonomy/i);
  });
});

describe('TaxonomyService.coerceSlug', () => {
  const service = new TaxonomyService(prismaStub(topics) as any);
  const allowed = ['en.prepositions-of-place', 'en.other'];

  it('passes a slug that is in the taxonomy', () => {
    expect(service.coerceSlug('en.prepositions-of-place', allowed, 'en')).toEqual({
      slug: 'en.prepositions-of-place',
      coerced: false,
    });
  });

  it('coerces an invented slug to the language fallback', () => {
    expect(service.coerceSlug('en.made-up-by-the-model', allowed, 'en')).toEqual({
      slug: 'en.other',
      coerced: true,
    });
  });

  it('coerces an empty slug to the fallback', () => {
    expect(service.coerceSlug('', allowed, 'en')).toEqual({ slug: 'en.other', coerced: true });
  });

  it('coerces another language\'s slug to this language\'s fallback', () => {
    expect(service.coerceSlug('de.word-order', allowed, 'en')).toEqual({
      slug: 'en.other',
      coerced: true,
    });
  });
});

describe('TaxonomyService.titleFor', () => {
  it('returns the title in the material language', async () => {
    const service = new TaxonomyService(prismaStub(topics) as any);

    expect(await service.titleFor('en.prepositions-of-place', 'ru')).toBe('Предлоги места');
  });

  it('falls back to the English title when the material language has none', async () => {
    const service = new TaxonomyService(
      prismaStub([{ slug: 'en.x', languageCode: 'en', titles: { en: 'X' }, sortOrder: 1 }]) as any,
    );

    expect(await service.titleFor('en.x', 'ru')).toBe('X');
  });

  it('returns null for a slug that does not exist', async () => {
    const service = new TaxonomyService(prismaStub(topics) as any);

    expect(await service.titleFor('en.nope', 'ru')).toBeNull();
  });
});
