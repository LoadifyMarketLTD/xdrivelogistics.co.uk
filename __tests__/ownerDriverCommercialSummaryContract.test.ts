import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/driver/dashboard/commercial-summary/route.ts'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'app/driver/page.tsx'), 'utf8');

describe('Owner Driver commercial summary contract', () => {
  it('authorizes the commercial summary server-side for Owner Driver only', () => {
    expect(route).toContain(".select('id, company_id, driver_type, can_commercial_bid')");
    expect(route).toContain("normalise(driver.driver_type) !== 'owner_driver'");
    expect(route).toContain('driver.can_commercial_bid !== true');
    expect(route).toContain("if (role !== 'owner')");
    expect(route).toContain('Owner Driver company-owner access is required.');
  });

  it('calculates real revenue, subcontract spend and margin from server records', () => {
    expect(route).toContain(".from('invoices')");
    expect(route).toContain(".eq('company_id', driver.company_id)");
    expect(route).toContain(".eq('buyer_company_id', driver.company_id)");
    expect(route).toContain('const revenueGross = revenueRows.reduce');
    expect(route).toContain('const subcontractSpend = payableRows.reduce');
    expect(route).toContain('recordedGrossMargin: revenueGross - subcontractSpend');
    expect(route).toContain('bookingsSubcontracted: subcontractedBookings');
  });

  it('supports bounded reporting periods and verified 90-day feedback', () => {
    expect(route).toContain("['today', '7d', '30d', 'all', 'custom']");
    expect(route).toContain("feedbackCutoff.setDate(feedbackCutoff.getDate() - 90)");
    expect(route).toContain('receivedRatingAverage');
  });

  it('connects the existing Owner Driver dashboard without replacing its current shell', () => {
    expect(dashboard).toContain("type CommercialPeriod = 'today' | '7d' | '30d' | 'all'");
    expect(dashboard).toContain('/api/driver/dashboard/commercial-summary?period=');
    expect(dashboard).toContain('Commercial reporting period');
    expect(dashboard).toContain('Revenue gross');
    expect(dashboard).toContain('Subcontract spend');
    expect(dashboard).toContain('Recorded gross margin');
    expect(dashboard).toContain('Average received rating');
    expect(dashboard).toContain('Owner Driver Commercial Position');
  });
});
