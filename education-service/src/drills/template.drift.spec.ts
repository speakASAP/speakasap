import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * `template.ts` beside this test is a VENDORED COPY of
 * `content-service/src/drills/template.ts`, copied per Track B2's plan because
 * Track D (which was to own the shared copy) had not landed.
 *
 * Two services parsing the same markup with different code is a silent
 * correctness bug: education-service would segment a template one way while
 * content-service hashed it another. This test fails the moment the two files
 * diverge by a single byte.
 *
 * If it fails: re-copy the content-service file, do not patch this one in place.
 */
describe('drills/template.ts vendored copy', () => {
  it('is byte-identical to the content-service source', () => {
    const mine = readFileSync(join(__dirname, 'template.ts'));
    const source = readFileSync(
      join(__dirname, '../../../content-service/src/drills/template.ts'),
    );
    const digest = (b: Buffer) => createHash('sha256').update(b).digest('hex');
    expect(digest(mine)).toBe(digest(source));
  });
});
