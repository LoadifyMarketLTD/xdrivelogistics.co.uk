import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'), 'utf8');

describe('CX carrier dashboard reporting parity contract', () => {
  it('keeps recent carrier-awarded bookings visible at a glance', () => {
    expect(source).toContain('const latestBookings = useMemo');
    expect(source).toContain('title="Latest bookings"');
    expect(source).toContain("router.push(`/admin/jobs/${job.id}`)");
  });

  it('maps CX reporting/accounting shortcuts to verified XDrive registers', () => {
    expect(source).toContain('title="Reports & finance"');
    expect(source).toContain("router.push('/admin/invoices')");
    expect(source).toContain("router.push('/admin/finance/reports')");
    expect(source).toContain("router.push('/admin/diary')");
    expect(source).toContain("router.push('/admin/fleet/returns')");
    expect(source).toContain('XDrive does not fabricate dashboard margin estimates');
  });

  it('uses the canonical Exchange Quotes lifecycle from the carrier workflow', () => {
    expect(source).toContain("router.push('/admin/exchange-quotes')");
  });
});
