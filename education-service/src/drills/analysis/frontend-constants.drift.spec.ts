import { readFileSync } from 'fs';
import { join } from 'path';
import { MAX_REMEDIAL_SENTENCES, MIN_REMEDIAL_SENTENCES } from './remedial-composition';

/**
 * The frontend restates these two numbers to preview how long a remedial drill will be.
 * It cannot import them — different service, different build — so this test is the only
 * thing between a changed limit here and a teacher being shown a wrong count there.
 */
const frontendContracts = readFileSync(
  join(__dirname, '../../../../frontend/lib/drills/analysis/contracts.ts'),
  'utf8',
);

describe('frontend remedial constants', () => {
  it('matches the minimum', () => {
    expect(frontendContracts).toContain(
      `export const MIN_REMEDIAL_SENTENCES = ${MIN_REMEDIAL_SENTENCES};`,
    );
  });

  it('matches the maximum', () => {
    expect(frontendContracts).toContain(
      `export const MAX_REMEDIAL_SENTENCES = ${MAX_REMEDIAL_SENTENCES};`,
    );
  });
});
