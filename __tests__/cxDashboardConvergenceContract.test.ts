import fs from 'node:fs';
import path from 'node:path';

describe('CX dashboard convergence contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('keeps the customer operational action canvas ahead of summary KPI tiles', () => {
    const css = read('app/customer/customer-dashboard.css');

    expect(css).toMatch(/\.customer-dash-metrics\s*\{[\s\S]*?order:\s*2;/);
    expect(css).toMatch(/\.customer-exchange-dashboard\s*\{[\s\S]*?order:\s*1;/);
    expect(css).toMatch(/\.customer-dash-metrics\s*\{[\s\S]*?gap:\s*8px;/);
  });

  it('preserves the measured CX density contract instead of introducing oversized customer KPI geometry', () => {
    const css = read('app/customer/customer-dashboard.css');

    expect(css).toContain('min-height: 72px;');
    expect(css).toContain('font-size: 22px;');
    expect(css).toContain('border-radius: 4px;');
    expect(css).not.toContain('min-height: 100px;');
  });
});
