import { execFileSync } from 'child_process';
import { join } from 'path';

describe('drill contracts', () => {
  it('vendored copies match the source of truth', () => {
    const script = join(__dirname, '../../../shared/scripts/sync-drill-contracts.sh');
    expect(() => execFileSync(script, ['--check'], { encoding: 'utf8' })).not.toThrow();
  });
});
