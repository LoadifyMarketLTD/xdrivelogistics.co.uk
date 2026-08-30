import fs from 'node:fs';
import path from 'node:path';

describe('CX dashboard convergence contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('keeps the customer decision canvas ahead of supporting transport signals', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');

    expect(source).toContain('<div className="customer-exchange-dashboard">');
    expect(source).toContain('<OperationalSignalStrip');
    expect(source.indexOf('<div className="customer-exchange-dashboard">')).toBeLessThan(source.indexOf('<OperationalSignalStrip'));
    expect(source.indexOf('Loads requiring a decision')).toBeLessThan(source.indexOf('Recent quote activity'));
    expect(source.indexOf('Active deliveries')).toBeLessThan(source.indexOf('Recent quote activity'));
  });

  it('uses the compact shared signal strip instead of rendering the six large customer KPI buttons', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');
    const css = read('app/customer/customer-dashboard.css');

    expect(source).not.toContain('className="customer-dash-metrics"');
    expect(source).not.toContain('className="customer-dash-metric"');
    expect(source).toContain("label: 'Open Loads'");
    expect(source).toContain("label: 'Awaiting Award'");
    expect(css).not.toContain('min-height: 100px;');
  });

  it('keeps the measured customer control column and dense table contract', () => {
    const css = read('app/customer/customer-dashboard.css');

    expect(css).toContain('grid-template-columns: 315px minmax(0, 1fr);');
    expect(css).toContain('height: 42px;');
    expect(css).toContain('min-height: 40px;');
    expect(css).toContain('border-radius: 4px;');
  });
});
