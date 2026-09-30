import fs from 'node:fs';
import path from 'node:path';

describe('jobs workspace policy fresh-schema parity', () => {
  const bootstrap = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260927005300_bootstrap_jobs_workspace_policy_roles.sql'),
    'utf8',
  );
  const audit = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260927005322_reconcile_jobs_workspace_rls.sql'),
    'utf8',
  );

  it('moves canonical workspace SELECT policies to authenticated before the catalog audit', () => {
    expect('20260927005300' < '20260927005322').toBe(true);
    expect(bootstrap).toContain('DROP POLICY IF EXISTS jobs_select_assigned_driver');
    expect(bootstrap).toContain('CREATE POLICY jobs_select_assigned_driver');
    expect(bootstrap).toContain('TO authenticated');
    expect(bootstrap).toContain('USING (public.can_driver_access_job(id))');
    expect(bootstrap).toContain('DROP POLICY IF EXISTS jobs_select_non_driver');
    expect(bootstrap).toContain('USING (public.is_company_non_driver(company_id))');
  });

  it('matches the policies asserted by the following reconciliation migration', () => {
    expect(audit).toContain("policyname = 'jobs_select_assigned_driver'");
    expect(audit).toContain("policyname = 'jobs_select_non_driver'");
    expect(audit).toContain("'authenticated' = ANY (roles)");
  });
});