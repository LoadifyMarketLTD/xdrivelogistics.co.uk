import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260813101000_company_membership_authorization_boundary.sql'),
  'utf8',
);

describe('company membership authorization boundary migration', () => {
  it('removes permissive company UPDATE policies backed by legacy company_members', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS companies_update_member ON public.companies;');
    expect(migration).toContain(
      'DROP POLICY IF EXISTS companies_update_owner_or_admin_or_creator ON public.companies;',
    );
    expect(migration).toContain('CREATE POLICY companies_update_canonical_owner_admin_v4');
    expect(migration).toContain('USING (public.is_company_admin(id))');
  });

  it('uses company_memberships as the only membership authorization source', () => {
    expect(migration).toContain('FROM public.company_memberships cm');
    expect(migration).not.toMatch(/FROM\s+public\.company_members\b/);
    expect(migration).not.toMatch(/JOIN\s+public\.company_members\b/);
    expect(migration).not.toMatch(/INSERT\s+INTO\s+public\.company_members\b/i);
    expect(migration).not.toMatch(/UPDATE\s+public\.company_members\b/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.company_members\b/i);
  });

  it('preserves Owner Driver operator authority without consulting profile.role', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.is_company_operator(cid uuid)');
    expect(migration).toContain("IN ('owner', 'admin', 'dispatcher')");
    expect(migration).not.toMatch(/JOIN\s+public\.profiles\b/);
    expect(migration).not.toContain("p.role::text <> 'driver'");
    expect(migration).not.toContain("COALESCE(p.role, '') <> 'driver'");
  });

  it('rewires legacy admin and capability helpers to canonical memberships', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.can_manage_company_members');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.is_company_admin_of');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.is_company_members_admin');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.has_capability');
    expect(migration).toContain('public.active_company_membership_role');
    expect(migration).toContain("cm.status = 'active'");
  });

  it('replaces invite and workspace-audit legacy membership policies', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS invites_insert_company_admin ON public.invites;');
    expect(migration).toContain('CREATE POLICY invites_insert_canonical_admin_v4');
    expect(migration).toContain('CREATE POLICY invites_select_canonical_admin_v4');
    expect(migration).toContain('CREATE POLICY invites_update_canonical_admin_v4');
    expect(migration).toContain(
      'DROP POLICY IF EXISTS workspace_audit_select_company_member ON public.workspace_switch_audit;',
    );
    expect(migration).toContain('CREATE POLICY workspace_audit_select_canonical_member_v4');
  });
});
