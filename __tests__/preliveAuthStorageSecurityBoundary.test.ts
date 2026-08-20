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
const storageAuthority = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260820102500_prelive_onboarding_storage_review_authority.sql',
  ),
  'utf8',
);
const companyDocumentRoute = readFileSync(
  resolve(process.cwd(), 'app/api/company/documents/signed-url/route.ts'),
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
    expect(source).toMatch(/VALUES\s*\(\s*NEW\.id,\s*v_role,\s*'active',\s*v_full_name/s);
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

  it('makes direct onboarding-document review Platform Owner only', () => {
    expect(storageAuthority).toContain('DROP POLICY IF EXISTS onboarding_docs_select_reviewer ON storage.objects;');
    expect(storageAuthority).toContain('DROP POLICY IF EXISTS onboarding_docs_select_tenant_reviewer ON storage.objects;');
    expect(storageAuthority).toContain('CREATE POLICY onboarding_docs_select_platform_owner');
    expect(storageAuthority).toContain("p.role = 'owner'");
    expect(storageAuthority).toContain("COALESCE(p.status::text, '') = 'active'");
    expect(storageAuthority).not.toContain("role_in_company::text");
  });

  it('keeps storage policy documentation portable across Supabase-owned storage.objects', () => {
    expect(source).not.toMatch(/COMMENT\s+ON\s+POLICY[\s\S]*ON\s+storage\.objects/i);
    expect(storageAuthority).not.toMatch(/COMMENT\s+ON\s+POLICY[\s\S]*ON\s+storage\.objects/i);
  });

  it('keeps company document access behind the tenant-validated signed URL API', () => {
    expect(companyDocumentRoute).toContain(".eq('company_id', document.company_id)");
    expect(companyDocumentRoute).toContain(".eq('status', 'active')");
    expect(companyDocumentRoute).toContain('onboardingBelongsToCompany');
    expect(companyDocumentRoute).toContain('isCanonicalOnboardingObjectPath');
    expect(companyDocumentRoute).toContain(".from('onboarding-documents')");
    expect(companyDocumentRoute).toContain('.createSignedUrl(objectPath, 120)');
  });
});
