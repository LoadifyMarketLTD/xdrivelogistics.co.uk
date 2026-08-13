import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260813100000_jobs_driver_visibility_boundary.sql'),
  'utf8',
);

describe('jobs driver visibility boundary migration', () => {
  it('removes the blanket driver SELECT policy', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS drivers_select_all_jobs ON public.jobs;');
  });

  it('keeps public Exchange discovery limited to open posted/quoted jobs', () => {
    expect(migration).toContain("jobs.exchange_visibility = 'exchange'");
    expect(migration).toContain("IN ('posted', 'quoted')");
    expect(migration).toContain('CREATE POLICY jobs_exchange_select_policy');
  });

  it('requires an eligible driver instead of treating every authenticated driver as globally job-authorised', () => {
    expect(migration).toContain('d.user_id = auth.uid()');
    expect(migration).toContain('coalesce(d.app_access, true) = true');
    expect(migration).toContain("NOT IN ('suspended', 'inactive', 'rejected')");
  });

  it('preserves Owner Driver and eligible fleet operational discovery without requiring a driver row', () => {
    expect(migration).toContain("coalesce(cm.status, '') = 'active'");
    expect(migration).toContain("ARRAY['owner', 'admin', 'dispatcher', 'member', 'viewer']::text[]");
    expect(migration).toContain("ARRAY['owner', 'broker']::text[]");
  });

  it('does not remove the direct-invite or assigned/awarded relationship policies', () => {
    expect(migration).toContain('jobs_direct_invite_select');
    expect(migration).toContain('jobs_driver_assigned_or_awarded_v1');
    expect(migration).not.toContain('DROP POLICY IF EXISTS jobs_direct_invite_select');
    expect(migration).not.toContain('DROP POLICY IF EXISTS jobs_driver_assigned_or_awarded_v1');
  });
});
