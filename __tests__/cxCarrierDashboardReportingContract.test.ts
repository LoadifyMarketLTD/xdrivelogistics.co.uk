import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'), 'utf8');

describe('CX carrier dashboard reporting parity contract', () => {
  it('keeps recent carrier-awarded bookings in Activity at a glance', () => {
    expect(source).toContain('const latestBookings = useMemo');
    expect(source).toContain('title="Activity at a glance"');
    expect(source).toContain('Latest carrier-awarded bookings');
    expect(source).toContain('className={carrierStyles.bookingList}');
  });

  it('maps CX reporting/accounting concepts to verified XDrive registers', () => {
    expect(source).toContain('title="Reports & Statistics"');
    expect(source).toContain('title="Accounts Payable"');
    expect(source).toContain('title="Reports"');
    expect(source).toContain("router.push('/admin/invoices')");
    expect(source).toContain("router.push('/admin/finance/reports')");
    expect(source).toContain("router.push('/admin/won-work')");
  });

  it('does not recreate global Carrier navigation as dashboard shortcuts', () => {
    expect(source).not.toContain('Carrier workflow');
    expect(source).not.toContain('Find marketplace work');
    expect(source).not.toContain('Price and review marketplace quotes');
    expect(source).not.toContain('Return Journeys');
  });
});
