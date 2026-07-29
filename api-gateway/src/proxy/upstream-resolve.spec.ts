import { resolveUpstreamBaseUrl } from './upstream-resolve';

describe('resolveUpstreamBaseUrl — drill routes', () => {
  beforeEach(() => {
    process.env.EDUCATION_SERVICE_URL = 'http://education:4205';
    process.env.CONTENT_SERVICE_URL = 'http://content:4201';
    process.env.USER_SERVICE_URL = 'http://user:4206';
  });

  it('routes drill assignments to education-service', () => {
    expect(resolveUpstreamBaseUrl('/api/v1/drill-assignments/mine')).toBe('http://education:4205');
  });

  it('routes drill sets, items, topics and vocabulary to content-service', () => {
    expect(resolveUpstreamBaseUrl('/api/v1/drill-sets')).toBe('http://content:4201');
    expect(resolveUpstreamBaseUrl('/api/v1/drill-items/search')).toBe('http://content:4201');
    expect(resolveUpstreamBaseUrl('/api/v1/drill-topics')).toBe('http://content:4201');
    expect(resolveUpstreamBaseUrl('/api/v1/course-vocabulary')).toBe('http://content:4201');
  });

  it('routes internal drill assignments to education, NOT user-service', () => {
    expect(resolveUpstreamBaseUrl('/api/v1/internal/drill-assignments/by-student/42')).toBe(
      'http://education:4205',
    );
  });

  it('leaves other internal routes on user-service', () => {
    expect(resolveUpstreamBaseUrl('/api/v1/internal/anything-else')).toBe('http://user:4206');
  });
});
