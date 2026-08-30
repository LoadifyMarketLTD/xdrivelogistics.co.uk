import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830190500_enforce_onboarding_submit_ownership.sql'),
  'utf8',
);

describe('onboarding submission ownership authority', () => {
  it('binds authenticated submission to auth.uid()', () => {
    expect(migration).toContain('v_actor_user_id uuid := auth.uid();');
    expect(migration).toContain("v_caller_role text := COALESCE(auth.role(), '');");
    expect(migration).toContain("IF v_caller_role <> 'service_role' THEN");
    expect(migration).toContain('v_app.user_id IS DISTINCT FROM v_actor_user_id');
    expect(migration).toContain('Onboarding application access denied.');
  });

  it('performs the ownership check before invoking the private base implementation', () => {
    const ownershipGuard = migration.indexOf('v_app.user_id IS DISTINCT FROM v_actor_user_id');
    const baseCall = migration.indexOf('public.submit_onboarding_application_base_v1(p_application_id)');

    expect(ownershipGuard).toBeGreaterThan(-1);
    expect(baseCall).toBeGreaterThan(ownershipGuard);
  });

  it('keeps the base implementation unavailable to client and service roles', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM anon;',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM authenticated;',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM service_role;',
    );
  });

  it('preserves the intended wrapper ACL only', () => {
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO authenticated, service_role;',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM anon;',
    );
  });

  it('retains fail-safe manual approval behavior', () => {
    expect(migration).toContain("ps.key = 'company_approval_required'");
    expect(migration).toContain("lower(trim(COALESCE(v_setting_value, ''))) = 'false'");
    expect(migration).toContain('public.review_onboarding_application_atomic(');
  });
});
