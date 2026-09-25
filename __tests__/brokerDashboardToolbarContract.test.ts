import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('broker dashboard toolbar', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/broker/BrokerDashboardHome.tsx'), 'utf8');

  it('binds search, saved view and date range to state', () => {
    expect(source).toContain("const [searchTerm, setSearchTerm] = useState('')");
    expect(source).toContain("const [savedView, setSavedView]");
    expect(source).toContain("const [dateRange, setDateRange]");
    expect(source).toContain('value={searchTerm}');
    expect(source).toContain('onChange={(event) => setSearchTerm(event.target.value)}');
    expect(source).toContain('value={savedView}');
    expect(source).toContain('value={dateRange}');
  });

  it('filters dashboard jobs rather than rendering decorative controls', () => {
    expect(source).toContain('const filteredJobs = useMemo(() => {');
    expect(source).toContain("if (savedView === 'exceptions')");
    expect(source).toContain("if (savedView === 'margin')");
    expect(source).toContain('const awaitingAward = filteredJobs.filter(');
    expect(source).toContain("filteredJobs.filter((job) => classifyWorkspaceJobStage(job) === 'open').length");
  });
});
