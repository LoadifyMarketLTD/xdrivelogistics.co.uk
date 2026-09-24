import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const award = read('app/api/customer/bids/[id]/award/route.ts');
const allocation = read('supabase/migrations/20260816102500_preserve_fleet_reallocation_lifecycle.sql');
const operatorTransition = read('app/api/admin/jobs/[id]/transition/route.ts');
const driverAction = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
const tracking = read('app/api/tracking/jobs/[jobId]/route.ts');
const customerQuotes = read('app/customer/quotes/CustomerQuotesCxPage.tsx');
const driverJobs = read('app/api/driver/jobs/route.ts');
const invoiceGeneration = read('app/api/driver/finance/jobs/[jobId]/generate-invoice/route.ts');

describe('cross-workspace job lifecycle contract', () => {
  it('keeps the customer/broker commercial award atomic and establishes carrier authority', () => {
    expect(award).toContain("'accept_job_bid_atomic'");
    expect(award).toContain('awardedCarrierCompanyId: result.awarded_carrier_company_id');
    expect(customerQuotes).toContain("fetch(`/api/customer/bids/${id}/award`");
    expect(customerQuotes).toContain('Confirm Award');
  });

  it('moves the same awarded job into fleet allocation with an eligible driver and canonical vehicle', () => {
    expect(allocation).toContain('v_allowed_company_id := COALESCE(v_job.awarded_carrier_company_id, v_job.company_id);');
    expect(allocation).toContain("COALESCE(v_role, '') NOT IN ('owner', 'admin', 'dispatcher')");
    expect(allocation).toContain('public.driver_operational_eligibility(p_driver_id)');
    expect(allocation).toContain("v_next_status := 'allocated'");
    expect(allocation).toContain('assigned_driver_id = p_driver_id');
    expect(allocation).toContain('vehicle_id = CASE WHEN p_driver_id IS NULL THEN NULL ELSE v_driver_vehicle_id END');
  });

  it('exposes assigned work only to the assigned driver instead of leaking carrier jobs to every driver', () => {
    expect(driverJobs).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(driverAction).toContain(".eq('assigned_driver_id', driver.driverId)");
  });

  it('preserves the execution chain from allocation through collection, delivery and completion', () => {
    for (const transition of [
      "awarded: 'on_my_way'",
      "allocated: 'on_my_way'",
      "on_my_way: 'on_site_pickup'",
      "on_site_pickup: 'loaded'",
      "loaded: 'in_transit'",
      "in_transit: 'on_site_delivery'",
      "on_site_delivery: 'delivered'",
      "delivered: 'completed'",
    ]) expect(operatorTransition).toContain(transition);
    expect(operatorTransition).toContain("if (!job.assigned_driver_id)");
  });

  it('makes live tracking visible only to the posting company, awarded carrier or assigned driver', () => {
    expect(tracking).toContain('posterAccess');
    expect(tracking).toContain('carrierAccess');
    expect(tracking).toContain('driverSelf');
    expect(tracking).toContain("if (!posterAccess && !carrierAccess && !driverSelf.data)");
    expect(tracking).toContain(".eq('job_id', job.id)");
    expect(tracking).toContain(".eq('driver_id', job.assigned_driver_id)");
  });

  it('requires complete POD before delivery when POD is required and then connects to invoice generation', () => {
    expect(operatorTransition).toContain("parsed.data.nextStatus === 'delivered'");
    expect(operatorTransition).toContain('Complete POD is required before delivery');
    expect(operatorTransition).toContain('await autoGenerateMarketplaceInvoice');
    expect(invoiceGeneration).toContain('jobId');
  });
});
