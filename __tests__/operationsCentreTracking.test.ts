import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const migrationPath = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260728070000_fix_job_tracking_events_grants.sql',
);

const migrationSql = readFileSync(migrationPath, 'utf-8');

describe('job_tracking_events grants migration', () => {
  it('grants SELECT, INSERT, UPDATE, DELETE to authenticated', () => {
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_tracking_events TO authenticated',
    );
  });

  it('grants SELECT, INSERT, UPDATE, DELETE to service_role', () => {
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_tracking_events TO service_role',
    );
  });

  it('grants EXECUTE on can_non_driver_access_job to authenticated', () => {
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.can_non_driver_access_job(uuid) TO authenticated',
    );
  });

  it('grants EXECUTE on can_admin_manage_job to authenticated', () => {
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.can_admin_manage_job(uuid) TO authenticated',
    );
  });

  it('adds the table to the realtime publication', () => {
    expect(migrationSql).toContain(
      'ALTER PUBLICATION supabase_realtime ADD TABLE public.job_tracking_events',
    );
  });

  it('does not weaken RLS with USING (true) or broad grant to anon', () => {
    expect(migrationSql).not.toMatch(/USING\s*\(\s*true\s*\)/);
    expect(migrationSql).not.toContain('TO anon');
  });
});

describe('job_tracking_events RLS policy migration', () => {
  const rlsMigrationPath = join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '034_least_privilege_operational_rls.sql',
  );
  const rlsSql = readFileSync(rlsMigrationPath, 'utf-8');

  it('defines a SELECT policy scoped to can_non_driver_access_job', () => {
    expect(rlsSql).toContain('job_tracking_select_non_driver');
    expect(rlsSql).toContain('can_non_driver_access_job(job_id)');
  });

  it('drops the broad all_member policy before replacing it', () => {
    expect(rlsSql).toContain(
      'DROP POLICY IF EXISTS "job_tracking_all_member" ON public.job_tracking_events',
    );
  });

  it('does not grant access to anon or use USING (true)', () => {
    const trackingSection = rlsSql.slice(
      rlsSql.indexOf('-- job_tracking_events'),
    );
    expect(trackingSection).not.toMatch(/USING\s*\(\s*true\s*\)/);
    expect(trackingSection).not.toContain('TO anon');
  });
});
