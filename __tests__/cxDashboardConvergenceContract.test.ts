import fs from 'node:fs';
import path from 'node:path';

describe('Customer canonical dashboard convergence contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('keeps customer decision signals ahead of recent transport', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');
    expect(source).toContain('<KpiGrid>');
    expect(source).toContain('<KpiCard');
    expect(source.indexOf('<KpiGrid>')).toBeLessThan(source.indexOf('Activity at a glance'));
    expect(source).toContain('Quotes to Review');
    expect(source).toContain('Active Deliveries');
    expect(source).toContain('Outstanding Invoices');
  });

  it('uses truthful canonical customer metrics and POD evidence signals', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');
    expect(source).toContain('metricState(jobsDataset');
    expect(source).toContain('metricState(bidsDataset');
    expect(source).toContain("invoicesDataset.availability !== 'available'");
    expect(source).toContain('invoicesDataset.partialData || invoicesDataset.limitedData');
    expect(source).toContain('metrics.documentAlertJobs.length');
    expect(source).toContain("stage === 'completed' && job.pod_generated !== true");
    expect(source).toContain('broker_pod_review_status');
    expect(source).not.toContain('CUS-201');
  });
  it('keeps the measured customer control column and dense table contract', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');
    const css = read('app/customer/customer-dashboard.css');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    // Customer statistics and table geometry are owned by shared primitives.
    expect(css).not.toContain('.customer-owner-stat-grid');
    expect(source).toContain('<KpiGrid>');
    expect(css).toContain('min-height: var(--ws-operational-row-min-h, 52px);');
    expect(css).not.toMatch(/grid-template-columns:\s*(?:165|185|220)px\s+minmax\(0,\s*1fr\)/);
    expect(baseline).toContain('.xdrive-workspace-measured .workspace-board-layout');
    expect(baseline).toContain('grid-template-columns: var(--ws-filter-rail-w) minmax(0, 1fr) !important;');
    expect(baseline).toContain('.xdrive-workspace-measured thead th {');
    expect(baseline).toContain('height: var(--ws-table-head-h) !important;');
    expect(baseline).toContain('font-size: var(--ws-font-body) !important;');
    expect(baseline).toContain('--ws-operational-row-min-h: 52px');
    expect(baseline).toContain('--ws-filter-rail-w: 165px');
    expect(baseline).toContain('--ws-table-row-h: 42px');
  });
});
