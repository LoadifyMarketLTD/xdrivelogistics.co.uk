import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/components/workspace/CompanyMarketplaceExchange.tsx'),
  'utf8',
);

describe('CX Loads location autocomplete stability', () => {
  it('does not auto-run the marketplace search while FROM or TO text is being typed', () => {
    const start = source.indexOf('const autoLoadsFilterKey = useMemo');
    const end = source.indexOf('}), [filters]);', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const autoRefreshBlock = source.slice(start, end);
    expect(autoRefreshBlock).toContain('fromRadius: filters.fromRadius');
    expect(autoRefreshBlock).toContain('toRadius: filters.toRadius');
    expect(autoRefreshBlock).not.toContain('from: filters.from');
    expect(autoRefreshBlock).not.toContain('to: filters.to');
    expect(source).toContain('if (tab === \'loads\') void loadLoadsRef.current(1, false)');
  });

  it('keeps explicit Search as the action that applies FROM and TO', () => {
    expect(source).toContain('onClick={() => void loadLoads(1, true)}');
    expect(source).toContain("onChange={(e) => setFilter('from', e.target.value)}");
    expect(source).toContain("onChange={(e) => setFilter('to', e.target.value)}");
  });
});
