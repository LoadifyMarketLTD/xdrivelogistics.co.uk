import fs from 'node:fs';
import path from 'node:path';

describe('Customer approved dashboard convergence contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('keeps the six customer decision signals ahead of the operational canvas', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');
    expect(source).toContain('className="customer-dash-metrics"');
    expect(source).toContain('className="customer-dash-metric"');
    expect(source.indexOf('customer-dash-metrics')).toBeLessThan(source.indexOf('customer-exchange-dashboard'));
    expect(source.indexOf('Loads requiring a decision')).toBeLessThan(source.indexOf('Recent quote activity'));
    expect(source.indexOf('Active deliveries')).toBeLessThan(source.indexOf('Recent quote activity'));
  });

  it('uses truthful server-authoritative customer metrics', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');
    expect(source).toContain('metricState(jobsDataset');
    expect(source).toContain('combinedMetricState([jobsDataset, bidsDataset]');
    expect(source).toContain('metrics.podReadyJobs.length');
    expect(source).not.toContain('CUS-201');
  });

  it('keeps the measured customer control column and dense table contract', () => {
    const css = read('app/customer/customer-dashboard.css');
    expect(css).toContain('grid-template-columns: repeat(6, minmax(0, 1fr));');
    expect(css).toContain('grid-template-columns: 315px minmax(0, 1fr);');
    expect(css).toContain('height: 42px;');
    expect(css).toContain('min-height: 40px;');
    expect(css).toContain('border-radius: 4px;');
  });
});
