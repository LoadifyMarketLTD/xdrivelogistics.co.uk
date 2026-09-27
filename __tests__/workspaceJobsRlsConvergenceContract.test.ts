import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260927005322_reconcile_jobs_workspace_rls.sql'),
  'utf8',
);

describe('workspace jobs RLS convergence contract', () => {
  it('removes broad authenticated-driver raw jobs reads', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS jobs_select_all_authenticated_drivers ON public.jobs');
    expect(migration).toContain('DROP POLICY IF EXISTS drivers_select_all_jobs ON public.jobs');
    expect(migration).toContain("policyname IN ('jobs_select_all_authenticated_drivers', 'drivers_select_all_jobs')");
  });

  it('requires active membership for creator assignment updates', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS jobs_update_creator_assign_any_member ON public.jobs');
    expect(migration).toContain('CREATE POLICY jobs_update_creator_assign_any_member');
    expect(migration).toContain("cm.status::text = 'active'");
    expect(migration).toContain("policyname = 'jobs_update_creator_assign_any_member'");
    expect(migration).not.toContain("cm.status <> 'suspended'");
  });

  it('restores the Marketplace execution privacy guard as RESTRICTIVE', () => {
    expect(migration).toContain('CREATE POLICY jobs_preaward_marketplace_privacy_guard');
    expect(migration).toContain('AS RESTRICTIVE');
    expect(migration).toContain('USING (public.can_read_marketplace_execution_job(id))');
    expect(migration).toContain("permissive = 'RESTRICTIVE'");
  });

  it('preserves assigned-driver, owning-company and awarded-carrier read paths', () => {
    expect(migration).toContain("policyname = 'jobs_select_assigned_driver'");
    expect(migration).toContain("policyname = 'jobs_select_non_driver'");
    expect(migration).toContain('CREATE POLICY jobs_awarded_carrier_select');
    expect(migration).toContain('public.is_company_member(awarded_carrier_company_id)');
  });
});
