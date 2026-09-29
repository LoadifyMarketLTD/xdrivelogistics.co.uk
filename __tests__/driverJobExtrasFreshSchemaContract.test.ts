import fs from 'node:fs';
import path from 'node:path';

describe('driver_job_extras fresh-schema bootstrap', () => {
  const bootstrap = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260926164900_bootstrap_driver_job_extras_base.sql'),
    'utf8',
  );
  const contractual = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260926164957_immutable_contractual_job_extras.sql'),
    'utf8',
  );

  it('creates the hosted base table before contractual hardening extends it', () => {
    expect('20260926164900' < '20260926164957').toBe(true);
    expect(bootstrap).toContain('CREATE TABLE IF NOT EXISTS public.driver_job_extras');
    expect(bootstrap).toContain('job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE');
    expect(bootstrap).toContain('driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE');
    expect(bootstrap).toContain('invoice_item_id uuid REFERENCES public.invoice_items(id) ON DELETE SET NULL');
    expect(contractual).toContain('ALTER TABLE public.driver_job_extras');
    expect(contractual).toContain('contractual_snapshot_hash text');
  });

  it('reproduces hosted fail-closed access before later RPCs use the table', () => {
    expect(bootstrap).toContain('ALTER TABLE public.driver_job_extras ENABLE ROW LEVEL SECURITY');
    expect(bootstrap).toContain('driver_job_extras_deny_anon');
    expect(bootstrap).toContain('driver_job_extras_deny_authenticated');
    expect(bootstrap).toContain('REVOKE ALL PRIVILEGES ON TABLE public.driver_job_extras FROM PUBLIC, anon, authenticated');
    expect(bootstrap).toContain('GRANT ALL PRIVILEGES ON TABLE public.driver_job_extras TO service_role');
  });

  it('reproduces hosted operational indexes and bounded base checks', () => {
    expect(bootstrap).toContain('idx_driver_job_extras_driver_status');
    expect(bootstrap).toContain('idx_driver_job_extras_job_created');
    expect(bootstrap).toContain('idx_driver_job_extras_supplier_status');
    expect(bootstrap).toContain("extra_type IN ('waiting_time','toll','parking','handball','other')");
    expect(bootstrap).toContain("status IN ('submitted','approved','rejected','invoiced')");
    expect(bootstrap).toContain('amount_gbp > 0 AND amount_gbp <= 10000');
  });
});