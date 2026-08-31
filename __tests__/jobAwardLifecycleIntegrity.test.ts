import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830192000_reconcile_job_award_lifecycle_integrity.sql'),
  'utf8',
);
const runtimeProof = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830192100_verify_job_award_lifecycle_runtime.sql'),
  'utf8',
);

describe('job award lifecycle integrity', () => {
  it('reconstructs the hosted canonical jobs test marker before first use', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false');
    expect(migration).toContain("c.column_name = 'is_test'");
    expect(migration).toContain('jobs.is_test clean-replay contract is not BOOLEAN NOT NULL DEFAULT false.');
  });

  it('keeps the hosted-only legacy POD dependency conditional without recreating it', () => {
    expect(migration).toContain('p0_proof_of_delivery_dependency_exists');
    expect(migration).toContain("to_regclass('public.proof_of_delivery') IS NULL");
    expect(migration).toContain("EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.proof_of_delivery p WHERE p.job_id = $1)'");
    expect(migration).toContain('NOT public.p0_proof_of_delivery_dependency_exists(j.id)');
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.p0_proof_of_delivery_dependency_exists(uuid)');
    expect(migration).not.toContain('CREATE TABLE public.proof_of_delivery');
  });

  it('reconciles only historical marked test jobs with impossible posted+award state', () => {
    expect(migration).toContain('COALESCE(j.is_test, false) = true');
    expect(migration).toContain("SET status = 'cancelled'");
    expect(migration).toContain('j.accepted_bid_id IS NOT NULL');
    expect(migration).toContain('j.awarded_carrier_company_id IS NOT NULL');
    expect(migration).toContain('j.pickup_datetime < now()');
    expect(migration).toContain('NOT EXISTS (SELECT 1 FROM public.invoices');
  });

  it('rejects award or assignment authority while lifecycle is still pre-award', () => {
    expect(migration).toContain('guard_job_award_lifecycle_consistency');
    expect(migration).toContain("v_status IN ('draft', 'open', 'received', 'posted', 'quoted')");
    expect(migration).toContain('Award/assignment authority cannot coexist with pre-award job lifecycle');
  });

  it('requires accepted bid, awarded carrier, assigned company and Driver relationships to stay coherent', () => {
    expect(migration).toContain('An accepted bid requires an awarded carrier company.');
    expect(migration).toContain('Assigned company must match the awarded carrier company.');
    expect(migration).toContain('An assigned Driver requires an assigned company.');
  });

  it('does not block direct invite visibility before actual award', () => {
    expect(migration).toContain('Direct invites use direct_invite_company_id');
    expect(migration).not.toContain('NEW.direct_invite_company_id IS NOT NULL');
  });

  it('contains a zero-tolerance final invariant', () => {
    expect(migration).toContain('Job award lifecycle invariant failed');
  });

  it('proves an invalid award mutation is rejected without changing the test job', () => {
    expect(runtimeProof).toContain("WHEN SQLSTATE '23514'");
    expect(runtimeProof).toContain('Pre-award job accepted award authority without lifecycle transition.');
    expect(runtimeProof).toContain('Rejected award/lifecycle probe changed the test job.');
    expect(runtimeProof).toContain('Runtime proof finished with award authority in pre-award lifecycle.');
  });
});
