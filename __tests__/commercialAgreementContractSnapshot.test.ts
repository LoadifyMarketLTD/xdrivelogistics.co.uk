import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260926122255_contractual_commercial_agreement_snapshot.sql'),
  'utf8',
);

describe('commercial agreement contractual snapshot migration', () => {
  it('captures immutable buyer, supplier and job snapshots for new agreements', () => {
    expect(migration).toContain('buyer_snapshot jsonb');
    expect(migration).toContain('supplier_snapshot jsonb');
    expect(migration).toContain('job_snapshot jsonb');
    expect(migration).toContain("NEW.snapshot_schema_version := '1'");
    expect(migration).toContain('NEW.buyer_snapshot := jsonb_build_object');
    expect(migration).toContain('NEW.supplier_snapshot := jsonb_build_object');
    expect(migration).toContain('NEW.job_snapshot := jsonb_build_object');
  });

  it('records the core contracting identity and transport requirement', () => {
    for (const requiredField of [
      "'legal_name'", "'trading_name'", "'company_number'", "'vat_number'",
      "'address'", "'pickup'", "'delivery'", "'cargo'", "'requirements'", "'references'",
    ]) {
      expect(migration).toContain(requiredField);
    }
  });

  it('hashes the full commercial snapshot and keeps historical rows distinguishable', () => {
    expect(migration).toContain("digest(convert_to(v_hash_payload::text, 'UTF8'), 'sha256')");
    expect(migration).toContain("contract_snapshot_hash ~ '^[0-9a-f]{64}$'");
    expect(migration).toContain('Historical rows created before this feature may be null');
    expect(migration).not.toMatch(/UPDATE\s+public\.job_commercial_agreements\s+SET\s+(buyer_snapshot|supplier_snapshot|job_snapshot)/i);
  });

  it('retains the existing immutable commercial agreement trigger contract', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.fn_complete_commercial_agreement_snapshot()');
    expect(migration).toContain('BEFORE INSERT ON public.job_commercial_agreements');
    expect(migration).toContain('payment_due_days');
    expect(migration).toContain('agreed_gross_amount');
  });
});

