import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/driver/loads/page.tsx'), 'utf8');

describe('Driver Loads load type tabs', () => {
  it('makes the visible load-type tabs functional instead of decorative', () => {
    expect(source).toContain("type LoadTypeFilter = 'all' | 'on_demand' | 'regular_load' | 'daily_hire'");
    expect(source).toContain("selectLoadWindowTab(tab.id)");
    expect(source).toContain("setLoadTypeFilter(next === 'on_demand' ? 'on_demand' : 'all')");
    expect(source).toContain("(['regular_load','daily_hire'] as const).map(category=>");
    expect(source).toContain('setLoadTypeFilter(category)');
    expect(source).toContain("loadTypeFilter !== 'all' && loadType(load) !== loadTypeFilter");
  });

  it('persists and clears the load-type filter with saved search defaults', () => {
    expect(source).toContain('loadTypeFilter: LoadTypeFilter');
    expect(source).toContain("setLoadTypeFilter(saved.loadTypeFilter ?? 'all')");
    expect(source).toContain('loadTypeFilter, sortBy');
    expect(source).toContain("setLoadTypeFilter('all')");
  });
});
