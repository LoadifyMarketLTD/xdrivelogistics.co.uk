import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX global Expand all / Collapse all operational contract', () => {
  const shared = read('app/components/workspace/OperationalExpandAllControl.tsx');
  const driverJobs = read('app/driver/jobs/page.tsx');
  const driverLoads = read('app/driver/loads/page.tsx');
  const driverAdvancedLoads = read('app/driver/loads/search/page.tsx');
  const driverQuotes = read('app/driver/quotes/page.tsx');
  const driverDiary = read('app/driver/history/page.tsx');
  const driverReturns = read('app/driver/returns/page.tsx');
  const adminDiary = read('app/components/workspace/OperationsDiaryPage.tsx');
  const companyMarketplace = read('app/components/workspace/CompanyMarketplaceExchange.tsx');
  const adminJobs = read('app/components/workspace/JobsOperationalTable.tsx');

  it('keeps the shared control on the measured 24px / radius 4 contract', () => {
    const css = read('app/components/workspace/OperationalExpandAllControl.module.css');
    expect(shared).toContain("expanded ? 'Collapse all' : 'Expand all'");
    expect(css).toContain('height: 24px');
    expect(css).toContain('border-radius: 4px');
    expect(css).toContain('font-size: 11px');
  });

  it('keeps Driver Jobs globally expandable for the visible filtered records', () => {
    expect(driverJobs).toContain('OperationalExpandAllControl');
    expect(driverJobs).toContain('allVisibleExpanded');
    expect(driverJobs).toContain('filteredJobs.forEach');
  });

  it('keeps Driver Loads, Advanced Search, Quotes and Diary globally expandable', () => {
    expect(driverLoads).toContain("expandAll ? 'Collapse All Entries' : 'Expand All Entries'");
    expect(driverAdvancedLoads).toContain('OperationalExpandAllControl');
    expect(driverAdvancedLoads).toContain('allExpanded');
    expect(driverAdvancedLoads).toContain('new Set(loads.map');
    expect(driverQuotes).toContain("allVisibleExpanded ? 'Collapse All Entries' : 'Expand All Entries'");
    expect(driverDiary).toContain("allExpanded ? 'Collapse all' : 'Expand all'");
  });

  it('keeps Driver Return Journeys globally expandable even when no row is initially open', () => {
    expect(driverReturns).toContain('OperationalExpandAllControl');
    expect(driverReturns).toContain('allVisibleExpanded');
    expect(driverReturns).toContain('Object.fromEntries(journeys.map');
    expect(driverReturns).not.toContain("journeys.some((journey) => expanded[journey.id] === true) && <button");
  });

  it('keeps Admin Diary globally expandable', () => {
    expect(adminDiary).toContain('allVisibleExpanded');
    expect(adminDiary).toContain('toggleExpandAll');
    expect(adminDiary).toMatch(/Collapse all|Collapse All Entries/);
    expect(adminDiary).toMatch(/Expand all|Expand All Entries/);
  });

  it('keeps Company Marketplace load results globally expandable', () => {
    expect(companyMarketplace).toContain('OperationalExpandAllControl');
    expect(companyMarketplace).toContain('allVisibleExpanded');
    expect(companyMarketplace).toContain('new Set(loads.map');
  });

  it('keeps Admin Jobs globally expandable on desktop and mobile through the same state set', () => {
    expect(adminJobs).toContain('OperationalExpandAllControl');
    expect(adminJobs).toContain('allVisibleExpanded');
    expect(adminJobs).toContain('expandedRows');
    expect(adminJobs).toContain('for (const job of filteredJobs)');
    expect(adminJobs).toContain('jobsMobileCardList');
  });
});
