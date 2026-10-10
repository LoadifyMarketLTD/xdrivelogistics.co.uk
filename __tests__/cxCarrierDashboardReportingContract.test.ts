import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'), 'utf8');

describe('CX carrier dashboard reporting parity contract', () => {
  it('keeps recent carrier-awarded bookings visible at a glance', () => {
    expect(source).toContain('const latestBookings = useMemo');
    expect(source).toContain('title="Activity at a glance"');
    expect(source).toContain("columns={['Route', 'Pickup', 'Vehicle', 'Status', 'Evidence', 'Action']}");
    expect(source).toContain("router.push(needsAllocation ? `/admin/fleet/assignments?job=${job.id}` : `/admin/jobs/${job.id}`)");
  });

  it('maps reporting and finance shortcuts to verified XDrive registers', () => {
    expect(source).toContain('title="Commercial & Finance"');
    expect(source).toContain('title="Reports"');
    expect(source).toContain("router.push('/admin/invoices')");
    expect(source).toContain("router.push('/admin/diary')");
    expect(source).toContain("router.push('/admin/fleet/returns')");
    expect(source).toContain("router.push('/admin/fleet/resources')");
  });

  it('uses the canonical Exchange Quotes lifecycle from the carrier workflow', () => {
    expect(source).toContain("router.push('/admin/exchange-quotes')");
  });
});
