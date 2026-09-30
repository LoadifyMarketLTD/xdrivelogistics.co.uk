import fs from 'node:fs';
import path from 'node:path';

describe('company helper parameter transition fresh-schema contract', () => {
  const transition = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260927011513_transition_company_helper_parameter_names.sql'),
    'utf8',
  );
  const hardening = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260927011514_harden_active_membership_helpers.sql'),
    'utf8',
  );

  it('moves member/admin helpers to the hosted _company_id signature before hardening', () => {
    expect('20260927011513' < '20260927011514').toBe(true);
    expect(transition).toContain('DROP FUNCTION IF EXISTS public.is_company_member(uuid) CASCADE');
    expect(transition).toContain('DROP FUNCTION IF EXISTS public.is_company_admin(uuid) CASCADE');
    expect(transition).toContain('CREATE FUNCTION public.is_company_member(_company_id uuid)');
    expect(transition).toContain('CREATE FUNCTION public.is_company_admin(_company_id uuid)');
    expect(hardening).toContain('CREATE OR REPLACE FUNCTION public.is_company_member(_company_id uuid)');
    expect(hardening).toContain('CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id uuid)');
  });

  it('preserves dependent RLS policies and hosted execution grants', () => {
    expect(transition).toContain('CREATE TEMP TABLE _company_helper_policy_backup');
    expect(transition).toContain("d.classid = 'pg_policy'::regclass");
    expect(transition).toContain("d.refclassid = 'pg_proc'::regclass");
    expect(transition).toContain('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s');
    expect(transition).toContain('TO authenticated, service_role');
    expect(transition).toContain('FROM PUBLIC, anon');
  });
});