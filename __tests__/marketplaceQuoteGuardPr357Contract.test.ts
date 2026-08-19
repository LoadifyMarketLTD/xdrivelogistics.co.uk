import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260819140500_harden_marketplace_quote_guard_pr357_schema.sql'),
  'utf8',
);

describe('PR357-compatible Marketplace quote guard', () => {
  it('does not import the PR359 bidder schema rewrite', () => {
    expect(source).not.toContain('NEW.bidder_company_id');
    expect(source).not.toContain('NEW.bidder_id :=');
    expect(source).not.toContain('ALTER TABLE public.job_bids');
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
});
