import fs from 'node:fs';
import path from 'node:path';

describe('Customer canonical dashboard convergence contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('keeps customer decision signals ahead of recent transport', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');
    expect(source).toContain('className="customer-owner-stat-grid"');
    expect(source).toContain('className="customer-owner-stat-card"');
    expect(source.indexOf('customer-owner-stat-grid')).toBeLessThan(source.indexOf('Activity at a glance'));
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
    const css = read('app/customer/customer-dashboard.css');
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(css).toContain('grid-template-columns: 185px minmax(0, 1fr);');
    expect(css).toContain('height: 46px;');
    expect(css).toContain('min-height: 46px;');
    expect(css).toContain('border-radius: 4px;');
  });
});
