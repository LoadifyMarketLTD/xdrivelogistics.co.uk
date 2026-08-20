import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260820102000_prelive_auth_storage_security_boundaries.sql',
  ),
  'utf8',
);

describe('PreLive Auth and onboarding Storage P0 boundaries', () => {
  it('fails closed instead of accepting platform-owner aliases from signup metadata', () => {
    expect(source).toContain("ELSE 'customer'");
    expect(source).not.toContain("WHEN 'owner' THEN 'owner'");
    expect(source).not.toContain("WHEN 'platform_owner' THEN 'owner'");
    expect(source).not.toContain("WHEN 'super_admin' THEN 'owner'");
    expect(source).not.toContain("WHEN 'superadmin' THEN 'owner'");
    expect(source).not.toContain("raw_user_meta_data ->> 'status'");
    expect(source).toContain("'active',\n    v_full_name");
  });

  it('preserves the legitimate non-platform signup and invitation identities', () => {
    expect(source).toContain("WHEN 'company_admin' THEN 'company_admin'");
    expect(source).toContain("WHEN 'company_staff' THEN 'company_staff'");
    expect(source).toContain("WHEN 'broker' THEN 'broker'");
    expect(source).toContain("WHEN 'driver' THEN 'driver'");
    expect(source).toContain("WHEN 'customer' THEN 'customer'");
  });

  it('blocks authenticated self-mutation of authoritative profile fields', () => {
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.guard_profile_authority_fields()');
    expect(source).toContain("v_jwt_role = 'authenticated'");
    expect(source).toContain('NEW.role IS DISTINCT FROM OLD.role');
    expect(source).toContain('NEW.status IS DISTINCT FROM OLD.status');
    expect(source).toContain('NEW.company_id IS DISTINCT FROM OLD.company_id');
    expect(source).toContain('NEW.is_driver IS DISTINCT FROM OLD.is_driver');
    expect(source).toContain("USING ERRCODE = '42501'");
  });

  it('removes the global company_admin Storage reviewer and binds company review to the application tenant', () => {
    expect(source).toContain('DROP POLICY IF EXISTS onboarding_docs_select_reviewer ON storage.objects;');
    expect(source).toContain('CREATE POLICY onboarding_docs_select_tenant_reviewer');
    expect(source).toContain("p.role = 'owner'");
    expect(source).toContain('cm.company_id = oa.company_id');
    expect(source).toContain('cm.user_id = auth.uid()');
    expect(source).toContain("COALESCE(cm.status::text, '') = 'active'");
    expect(source).toContain("COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin')");
    expect(source).toContain("oa.user_id::text = (storage.foldername(name))[1]");
    expect(source).toContain("oa.id::text = (storage.foldername(name))[2]");
  });
});
