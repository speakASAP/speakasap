import { buildSetListQuery, groupByLesson } from './sets.query';

describe('buildSetListQuery', () => {
  it('filters by course and lesson when no search term is given', () => {
    const { where } = buildSetListQuery({ courseKey: 'seven:german:ru', lessonOrder: 5 });
    expect(where).toMatchObject({ courseKey: 'seven:german:ru', lessonOrder: 5 });
  });

  it('DROPS the course and lesson filters when a search term is given', () => {
    const { where } = buildSetListQuery({
      courseKey: 'seven:german:ru',
      lessonOrder: 5,
      q: 'whale elephant',
    });
    expect(where).not.toHaveProperty('courseKey');
    expect(where).not.toHaveProperty('lessonOrder');
  });

  it('sorts by popularity descending by default', () => {
    const { orderBy } = buildSetListQuery({});
    expect(orderBy).toEqual([{ popularityScore: 'desc' }, { createdAt: 'desc' }]);
  });

  it('sorts by recency when asked', () => {
    const { orderBy } = buildSetListQuery({ sort: 'recent' });
    expect(orderBy).toEqual([{ createdAt: 'desc' }]);
  });

  it('caps limit at 100 and defaults to 25', () => {
    expect(buildSetListQuery({}).take).toBe(25);
    expect(buildSetListQuery({ limit: 5000 }).take).toBe(100);
  });

  it('omits an empty topicSlugs filter rather than matching nothing', () => {
    const { where } = buildSetListQuery({ topicSlugs: [] });
    expect(where).not.toHaveProperty('topicSlugs');
  });
});

describe('groupByLesson', () => {
  it('buckets by courseKey and lessonOrder, with an unassigned bucket', () => {
    const groups = groupByLesson([
      { uuid: 'a', courseKey: 'seven:german:ru', lessonOrder: 5 },
      { uuid: 'b', courseKey: 'seven:german:ru', lessonOrder: 5 },
      { uuid: 'c', courseKey: null, lessonOrder: null },
    ] as any);
    expect(groups['seven:german:ru#5']).toEqual(['a', 'b']);
    expect(groups['unassigned']).toEqual(['c']);
  });
});
