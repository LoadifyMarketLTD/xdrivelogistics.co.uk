import fs from 'node:fs';
import path from 'node:path';

describe('Carrier CX dashboard convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'),
    'utf8',
  );
  const css = fs.readFileSync(
    path.join(process.cwd(), 'app/admin/carrier-workspace-canonical.css'),
    'utf8',
  );

  it('uses the live-CX dashboard information architecture', () => {
    for (const label of [
      'Reports & Statistics',
      'Activity at a glance',
      'Latest Bookings',
      'Accounts Payable',
      'Reports',
      'Feedback in Last 90 Days',
      'Compliance - Manage Your Suppliers',
      'Gross Margin',
      'Sub-contract Spend',
    ]) {
      expect(source).toContain(label);
    }
  });

  it('removes the duplicated operational workboard from the Dashboard surface', () => {
    expect(source).not.toContain('Operational workboard');
    expect(source).not.toContain('<OperationalPageLayout');
    expect(source).not.toContain('<OperationalFilters');
    expect(source).not.toContain('<DataTable');
    expect(source).toContain('carrier-cx-booking-filters');
    expect(source).toContain('Member / Driver / ID');
    expect(source).toContain('Load ID / Ref');
    expect(source).toContain('isCompanyExecutionJob(job, data.companyId)');
  });

  it('renders latest bookings as operational cards instead of the old dashboard table', () => {
    expect(source).toContain('className="carrier-cx-booking-card"');
    expect(source).toContain('className="carrier-cx-booking-route"');
    expect(source).toContain('className="carrier-cx-booking-schedule"');
    expect(source).toContain('className="carrier-cx-booking-meta"');
    expect(source).toContain('className="carrier-cx-booking-actions"');
    expect(css).toContain('.xdrive-carrier-workspace .carrier-cx-booking-card');
  });

  it('keeps dashboard actions connected to real XDrive registers', () => {
    for (const route of [
      '/admin/won-work',
      '/admin/invoices',
      '/admin/diary',
      '/admin/fleet/assignments',
      '/admin/fleet/returns',
      '/admin/fleet/compliance',
      '/admin/marketplace/directory',
      '/admin/marketplace',
      '/admin/live-availability',
      '/admin/jobs/',
    ]) {
      expect(source).toContain(route);
    }
  });
});
