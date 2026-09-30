import fs from 'node:fs';
import path from 'node:path';

describe('Carrier CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'),
    'utf8',
  );
  const visualCss = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/CarrierDashboard.module.css'),
    'utf8',
  );

  it('follows the CX dashboard information architecture', () => {
    for (const section of [
      'Reports & Statistics',
      'Accounts Payable',
      'Reports',
      'Feedback in Last 90 Days',
      'Activity at a glance',
      'Compliance - Drivers & Vehicles',
    ]) {
      expect(source).toContain(section);
    }
    expect(source).not.toContain('Operational workboard');
    expect(source).not.toContain('Carrier workflow');
  });

  it('keeps the main desktop split close to the CX dashboard left/right balance', () => {
    expect(source).toContain('className={carrierStyles.cxDashboardGrid}');
    expect(visualCss).toContain('grid-template-columns: minmax(0, 0.43fr) minmax(0, 0.57fr);');
    expect(visualCss).toContain('grid-template-columns: minmax(0, 1.35fr) minmax(160px, .85fr) minmax(150px, .7fr);');
  });

  it('keeps verified XDrive commercial truth without fabricating unavailable feedback', () => {
    expect(source).toContain("normalise(bid.status) === 'accepted' && awardedJobIds.has(bid.job_id)");
    expect(source).toContain("toCanonicalInvoiceDisplayStatus(invoice.status, invoice.due_date, invoice.payment_status) === 'Overdue'");
    expect(source).toContain('Verified feedback data is not included in the current Carrier feed.');
    expect(source).toContain('No rating or performance score is fabricated.');
  });

  it('keeps operational actions contextual to each booking', () => {
    expect(source).toContain('className={carrierStyles.bookingActions}');
    expect(source).toContain('/admin/fleet/assignments?job=');
    expect(source).toContain('/admin/jobs/');
    expect(source).not.toContain('Find marketplace work');
    expect(source).not.toContain('Price and review marketplace quotes');
  });
});
