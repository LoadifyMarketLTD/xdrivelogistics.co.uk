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

  it('connects the approved Owner Driver dashboard to the server-authoritative commercial summary', () => {
    expect(dashboard).toContain("'today' | '7d' | '30d' | 'all' | 'custom'");
    expect(dashboard).toContain('new URLSearchParams({ period: commercialPeriod })');
    expect(dashboard).toContain("params.set('from', commercialFrom)");
    expect(dashboard).toContain("params.set('to', commercialTo)");
    expect(dashboard).toContain('/api/driver/dashboard/commercial-summary?');
    expect(dashboard).toContain('Income period');
    expect(dashboard).toContain('Invoiced Revenue');
    expect(dashboard).toContain('POD Requiring Action');
    expect(dashboard).toContain('feedback90Days.receivedRatingAverage');
    expect(dashboard).toContain('Work & Marketplace');
    expect(dashboard).toContain('My Business');
  });
});
