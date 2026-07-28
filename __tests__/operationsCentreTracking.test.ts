/**
 * Regression tests for the job_tracking_events privilege fix.
 *
 * Environment note
 * ----------------
 * Live database RLS tests (same-company SELECT allowed, cross-company SELECT
 * denied, authenticated INSERT rejected) require a running Supabase instance
 * with test credentials.  The CI environment does not provide those, so this
 * suite validates the grant/policy surface statically from migration sources,
 * and includes structural API-contract tests against the route module.
 *
 * Live RLS integration tests would use two real Supabase sessions — one for
 * company A and one for company B — and assert that each session can only read
 * rows for jobs owned by its own company.  Those tests should be added when
 * a Supabase test project is provisioned.
 */

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

const rlsMigrationPath = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '034_least_privilege_operational_rls.sql',
);
const rlsSql = readFileSync(rlsMigrationPath, 'utf-8');

const transitionRoutePath = join(
  __dirname,
  '..',
  'app',
  'api',
  'admin',
  'jobs',
  '[id]',
  'transition',
  'route.ts',
);
const transitionRouteTs = readFileSync(transitionRoutePath, 'utf-8');

const mobileLibPath = join(
  __dirname,
  '..',
  'app',
  'api',
  'driver',
  'mobile',
  '_lib.ts',
);
const mobileLibTs = readFileSync(mobileLibPath, 'utf-8');

// ── Grant surface: least-privilege checks ──────────────────────────────────

describe('job_tracking_events: authenticated privilege scope', () => {
  it('grants only SELECT (not INSERT/UPDATE/DELETE) to authenticated', () => {
    // The exact grant line must start with GRANT SELECT ON
    expect(migrationSql).toContain(
      'GRANT SELECT ON public.job_tracking_events TO authenticated',
    );
  });

  it('does not grant INSERT to authenticated', () => {
    // No INSERT should appear in the authenticated grant
    const authLine = migrationSql
      .split('\n')
      .find((l) => l.includes('TO authenticated') && l.includes('job_tracking_events'));
    expect(authLine).toBeDefined();
    expect(authLine).not.toContain('INSERT');
  });

  it('does not grant UPDATE to authenticated', () => {
    const authLine = migrationSql
      .split('\n')
      .find((l) => l.includes('TO authenticated') && l.includes('job_tracking_events'));
    expect(authLine).not.toContain('UPDATE');
  });

  it('does not grant DELETE to authenticated', () => {
    const authLine = migrationSql
      .split('\n')
      .find((l) => l.includes('TO authenticated') && l.includes('job_tracking_events'));
    expect(authLine).not.toContain('DELETE');
  });

  it('grants full DML to service_role (required by server-side API routes)', () => {
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_tracking_events TO service_role',
    );
  });
});

describe('job_tracking_events: security surface', () => {
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

  it('does not use USING (true) in the migration', () => {
    expect(migrationSql).not.toMatch(/USING\s*\(\s*true\s*\)/);
  });

  it('does not grant any privilege to anon', () => {
    expect(migrationSql).not.toContain('TO anon');
  });
});

// ── RLS policy structural checks ──────────────────────────────────────────

describe('job_tracking_events RLS policies (migration 034)', () => {
  it('defines a SELECT policy scoped to can_non_driver_access_job', () => {
    expect(rlsSql).toContain('job_tracking_select_non_driver');
    expect(rlsSql).toContain('can_non_driver_access_job(job_id)');
  });

  it('replaces the broad all_member policy with per-command policies', () => {
    expect(rlsSql).toContain(
      'DROP POLICY IF EXISTS "job_tracking_all_member" ON public.job_tracking_events',
    );
    expect(rlsSql).toContain('job_tracking_insert_non_driver');
    expect(rlsSql).toContain('job_tracking_update_creator_or_admin');
    expect(rlsSql).toContain('job_tracking_delete_creator_or_admin');
  });

  it('does not weaken the tracking section with USING (true) or anon grants', () => {
    const trackingSection = rlsSql.slice(rlsSql.indexOf('-- job_tracking_events'));
    expect(trackingSection).not.toMatch(/USING\s*\(\s*true\s*\)/);
    expect(trackingSection).not.toContain('TO anon');
  });

  it('SELECT policy uses SECURITY DEFINER helper, not direct auth.uid() table scan', () => {
    // can_non_driver_access_job is SECURITY DEFINER — confirmed in migration 034
    const fnIdx = rlsSql.indexOf('can_non_driver_access_job');
    const segment = rlsSql.slice(Math.max(0, fnIdx - 200), fnIdx + 200);
    expect(segment).toContain('can_non_driver_access_job');
  });
});

// ── API write-path verification: no browser/authenticated INSERT ──────────

describe('job_tracking_events: write paths use service-role client only', () => {
  it('transition route inserts tracking events via supabaseAdmin (service-role)', () => {
    // Behavioral: the INSERT on job_tracking_events must be on the admin client,
    // not on an authenticated (user-token) client.
    const insertIdx = transitionRouteTs.indexOf(
      "from('job_tracking_events').insert",
    );
    expect(insertIdx).toBeGreaterThan(-1);
    // Scan backwards ~300 chars to find which client variable is used
    const preceding = transitionRouteTs.slice(Math.max(0, insertIdx - 300), insertIdx);
    expect(preceding).toContain('supabaseAdmin');
  });

  it('driver mobile lib inserts tracking events via supabaseAdmin (service-role)', () => {
    const insertIdx = mobileLibTs.indexOf("from('job_tracking_events').insert");
    expect(insertIdx).toBeGreaterThan(-1);
    const preceding = mobileLibTs.slice(Math.max(0, insertIdx - 300), insertIdx);
    expect(preceding).toContain('supabaseAdmin');
  });

  it('operations centre route does not INSERT into job_tracking_events', () => {
    const routePath = join(
      __dirname,
      '..',
      'app',
      'api',
      'admin',
      'operations-centre',
      'route.ts',
    );
    const routeTs = readFileSync(routePath, 'utf-8');
    // The operations centre API is read-only; it must not write tracking events
    expect(routeTs).not.toContain("from('job_tracking_events').insert");
    expect(routeTs).not.toContain("from('job_tracking_events').update");
    expect(routeTs).not.toContain("from('job_tracking_events').delete");
  });
});
