import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('workspace canonical handoff geometry', () => {
  it('keeps Carrier scoped away from Driver and Super Admin', () => {
    const layout = read('app/admin/layout.tsx');
    const css = read('app/admin/carrier-workspace-canonical.css');
    expect(layout).toContain('xdrive-carrier-workspace');
    expect(css).toContain('.xdrive-carrier-workspace');
    expect(css).not.toContain('.xdrive-driver-workspace');
    expect(css).not.toContain('.super-admin');
  });

  it('keeps Carrier register and detail density on the approved reference', () => {
    const css = read('app/admin/carrier-workspace-canonical.css');
    expect(css).toContain('padding: 8px 10px 12px !important;');
    expect(css).toContain('height: 36px !important;');
    expect(css).toContain('height: 46px !important;');
    expect(css).toContain('height: 32px !important;');
    expect(css).toContain('font-size: 12.5px !important;');
    expect(css).toContain('border-radius: 3px !important;');
  });

  it('keeps Broker dashboard compact without a dead secondary column', () => {
    const layout = read('app/broker/layout.tsx');
    const css = read('app/broker/broker-dashboard-convergence.css');
    expect(layout).toContain('xdrive-broker-workspace');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(css).toContain('min-height: 78px;');
    expect(css).toContain('height: 36px;');
    expect(css).toContain('height: 46px;');
    expect(css).toContain('border-radius: 3px;');
  });

  it('keeps Customer rail and table geometry on the approved reference', () => {
    const layout = read('app/customer/layout.tsx');
    const css = read('app/customer/customer-dashboard.css');
    expect(layout).toContain('xdrive-customer-workspace');
    expect(css).toContain('grid-template-columns: 185px minmax(0, 1fr);');
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(css).toContain('height: 36px;');
    expect(css).toContain('height: 46px;');
    expect(css).toContain('font-size: 12.5px;');
  });

  it('keeps every legacy Carrier page inside an approved page model', () => {
    const registerPages = [
      'app/admin/bids/page.tsx',
      'app/admin/companies/page.tsx',
      'app/admin/dispatchers/page.tsx',
      'app/admin/disputes/page.tsx',
      'app/admin/documents/page.tsx',
      'app/admin/drivers/page.tsx',
      'app/admin/fleet/managers/page.tsx',
      'app/admin/vehicles/page.tsx',
    ];
    const detailPages = [
      'app/admin/invoices/[id]/page.tsx',
      'app/admin/invoices/new/page.tsx',
      'app/admin/jobs/[id]/page.tsx',
    ];

    for (const page of registerPages) expect(read(page)).toContain('carrier-register-page');
    for (const page of detailPages) expect(read(page)).toContain('carrier-detail-page');
  });

  it('keeps Carrier create-job and empty-state surfaces compact', () => {
    const jobs = read('app/admin/jobs/page.tsx');
    const css = read('app/admin/carrier-workspace-canonical.css');
    expect(jobs).toContain('carrier-job-create-header');
    expect(jobs).toContain('carrier-job-create-body');
    expect(jobs).toContain('carrier-job-create-actions');
    expect(css).toContain('.carrier-job-create-body .admin-job-section');
    expect(css).toContain('.carrier-register-empty');
  });
});
