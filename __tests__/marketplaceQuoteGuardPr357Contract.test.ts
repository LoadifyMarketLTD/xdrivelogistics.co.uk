import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const source = read('supabase/migrations/20260819140500_harden_marketplace_quote_guard_pr357_schema.sql');
const canonicalAward = read('supabase/migrations/20260815115500_named_driver_award_semantics.sql');
const legacyAssignmentRemoval = read('supabase/migrations/20260819154000_remove_legacy_accepted_bid_assignment_trigger.sql');

describe('PR357-compatible Marketplace quote guard', () => {
  it('does not import the PR359 bidder schema rewrite', () => {
    expect(source).not.toContain('NEW.bidder_company_id');
    expect(source).not.toContain('NEW.bidder_id :=');
    expect(source).not.toContain('ALTER TABLE public.job_bids');
  });

  it('preserves live legacy bidder attribution without requiring those columns on fresh replay', () => {
    expect(source).toContain("v_row := to_jsonb(NEW)");
    expect(source).toContain("v_row ? 'bidder_company_id'");
    expect(source).toContain("v_row ? 'bidder_id'");
    expect(source).toContain('jsonb_populate_record');
    expect(source).toContain('Company quote attribution is inconsistent.');
    expect(source).toContain('v_legacy_company_id IS DISTINCT FROM v_driver.company_id');
    expect(source).toContain('v_legacy_driver_id IS DISTINCT FROM v_driver.id');
  });

  it('guards every insert rather than only rows that already carry a named driver', () => {
    expect(source).toContain('CREATE TRIGGER trg_guard_driver_quote_mutation');
    expect(source).toContain('BEFORE INSERT ON public.job_bids');
    expect(source).toContain('FOR EACH ROW');
    expect(source).not.toContain('WHEN (NEW.bidder_driver_id IS NOT NULL)');
  });

  it('keeps distinct trusted company and authenticated driver paths fail closed', () => {
    expect(source).toContain('NEW.bidder_driver_id IS NULL AND v_actor IS NULL');
    expect(source).toContain('Company quote attribution is incomplete.');
    expect(source).toContain('Authenticated quote requires exactly one active own driver identity.');
    expect(source).toContain('public.driver_operational_eligibility(v_driver.id)');
    expect(source).toContain('public.can_quote_marketplace_job(NEW.job_id, NEW.company_id)');
  });

  it('preserves the approved named-driver versus company-only award contract', () => {
    expect(canonicalAward).toContain("v_final_status := CASE WHEN v_bidder_driver_id IS NOT NULL THEN 'allocated' ELSE 'awarded' END");
    expect(canonicalAward).toContain('assigned_driver_id = CASE WHEN v_bidder_driver_id IS NOT NULL THEN v_bidder_driver_id ELSE NULL END');
    expect(canonicalAward).toContain('vehicle_id = CASE WHEN v_bidder_driver_id IS NOT NULL THEN v_driver_vehicle_id ELSE NULL END');
  });

  it('removes the remote-only accepted_bid_id assignment bypass', () => {
    expect(legacyAssignmentRemoval).toContain('DROP TRIGGER IF EXISTS trg_sync_job_assignment_from_accepted_bid ON public.jobs');
    expect(legacyAssignmentRemoval).toContain('accept_job_bid_atomic');
    expect(legacyAssignmentRemoval).not.toContain('CREATE TRIGGER trg_sync_job_assignment_from_accepted_bid');
    expect(legacyAssignmentRemoval).not.toContain('ALTER TABLE public.job_bids');
  });
});
