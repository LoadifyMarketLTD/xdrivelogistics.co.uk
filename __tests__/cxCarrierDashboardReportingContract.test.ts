import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'), 'utf8');

describe('CX carrier dashboard reporting parity contract', () => {
  it('keeps recent carrier-awarded bookings visible at a glance', () => {
    expect(source).toContain('const latestBookings = useMemo');
    expect(source).toContain('title="Activity at a glance"');
    expect(source).toContain('className="carrier-cx-booking-list"');
    expect(source).toContain("router.push('/admin/diary')");
  });

  it('maps Accounts Payable and Reports to verified XDrive data', () => {
    expect(source).toContain('title="Accounts Payable"');
    expect(source).toContain('Latest Invoices Received');
    expect(source).toContain('Invoices due for Payment');
    expect(source).toContain('Invoices Awaiting Payment');
    expect(source).toContain('Monthly Totals');
    expect(source).toContain('Bookings Received');
    expect(source).toContain('Bookings Sub-contracted');
    expect(source).toContain('Loads Allocated');
    expect(source).toContain('Return Journeys');
  });

  it('derives feedback, payment and delivery performance without inventing static values', () => {
    expect(source).toContain("from('reviews')");
    expect(source).toContain('feedbackSummary');
    expect(source).toContain('Payment Performance');
    expect(source).toContain('Delivery Performance');
    expect(source).toContain('completedWithoutException');
  });
});
