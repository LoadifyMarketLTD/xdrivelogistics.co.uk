import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260820110000_reconcile_owner_driver_submit_physical_contract.sql',
  ),
  'utf8',
);

describe('owner-driver onboarding physical contract reconciliation', () => {
  it('patches only the preserved private submit base implementation', () => {
    expect(source).toContain("to_regprocedure('public.submit_onboarding_application_base_v1(uuid)')");
    expect(source).toContain('pg_get_functiondef');
    expect(source).toContain('name,\\n        full_name,\\n        display_name');
    expect(source).not.toContain('CREATE OR REPLACE FUNCTION public.submit_onboarding_application(');
  });

  it('fails closed on an unexpected historical function shape', () => {
    expect(source).toContain('Unexpected owner-driver INSERT shape');
    expect(source).toContain('Unexpected owner-driver VALUES shape');
    expect(source).toContain('refusing broad rewrite');
  });

  it('keeps the preserved base private after reconciliation', () => {
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM authenticated;',
    );
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM service_role;',
    );
  });
});
