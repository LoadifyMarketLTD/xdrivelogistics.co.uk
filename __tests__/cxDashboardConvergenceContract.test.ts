import fs from 'node:fs';
import path from 'node:path';

describe('Customer canonical dashboard convergence contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('keeps customer decision signals ahead of recent transport', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');
    expect(source).toContain('className="customer-dash-metrics"');
    expect(source).toContain('className="customer-dash-metric"');
    expect(source.indexOf('customer-dash-metrics')).toBeLessThan(source.indexOf('Recent transport'));
    expect(source).toContain('Quotes to review');
    expect(source).toContain('Active deliveries');
    expect(source).toContain('Outstanding invoices');
  });

  it('uses truthful canonical customer metrics and POD evidence signals', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');
    expect(source).toContain('metricState(jobsDataset');
    expect(source).toContain('metricState(bidsDataset');
    expect(source).toContain('metricState(invoicesDataset');
    expect(source).toContain('metrics.documentAlertJobs.length');
    expect(source).toContain('job.pod_required === true');
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
