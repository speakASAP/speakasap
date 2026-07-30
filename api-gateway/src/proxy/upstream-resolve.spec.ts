import { resolveUpstreamBaseUrl, ROUTES } from './upstream-resolve';

// Path-segment-aware prefix check, matching resolveUpstreamBaseUrl's own
// matching rule (pathname === prefix || pathname.startsWith(`${prefix}/`)).
// A plain `later.startsWith(earlier)` would false-positive on e.g.
// '/api/v1/drill-sets' vs '/api/v1/drill-set-x'.
function isSegmentPrefixOf(earlier: string, later: string): boolean {
  if (earlier === later) {
    return false;
  }
  return later.startsWith(`${earlier}/`);
}

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

describe('ROUTES ordering invariant', () => {
  // ROUTES is matched first-match-wins (see the file-level comment in
  // upstream-resolve.ts). Nothing stops a future track from adding a
  // broader prefix above a narrower one that already exists further down
  // the array, which would silently make the narrower entry unreachable.
  // This walks every ordered pair and fails if an earlier entry would
  // swallow a later one.
  it('never places a broader prefix above a narrower one it would shadow', () => {
    const violations: string[] = [];

    for (let i = 0; i < ROUTES.length; i += 1) {
      for (let j = i + 1; j < ROUTES.length; j += 1) {
        const earlier = ROUTES[i];
        const later = ROUTES[j];
        if (isSegmentPrefixOf(earlier.prefix, later.prefix)) {
          violations.push(
            `ROUTES[${i}] "${earlier.prefix}" (-> ${earlier.envKey}) shadows ` +
              `ROUTES[${j}] "${later.prefix}" (-> ${later.envKey})`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
