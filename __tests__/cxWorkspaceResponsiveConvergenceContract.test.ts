import fs from 'node:fs';
import path from 'node:path';

describe('CX workspace responsive convergence', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('stacks shared operational main/attention grids by tablet width', () => {
    const css = read('app/components/workspace/OperationalConvergence.module.css');
    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.workspaceGrid,[\s\S]*?\.controlGrid[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.signalStrip[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it('stacks the customer decision canvas and secondary operational grid by tablet width', () => {
    const css = read('app/customer/customer-dashboard.css');
    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.customer-exchange-dashboard,[\s\S]*?\.customer-ops-grid-2[\s\S]*?grid-template-columns:\s*1fr;/);
  });

  it('stacks the broker action centre and activity canvas by tablet width', () => {
    const css = read('app/broker/broker-dashboard-convergence.css');
    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.xdrive-broker-control-grid[\s\S]*?grid-template-columns:\s*1fr\s*!important;/);
  });

  it('returns the driver dashboard to a single-column layout by tablet width', () => {
    const css = read('app/driver/driver-dashboard-reference.css');
    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.driver-dashboard-layout[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.driver-dashboard-next-action[\s\S]*?flex-direction:\s*column;/);
  });
});
