import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const baseHardening = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260820102000_prelive_auth_storage_security_boundaries.sql',
  ),
  'utf8',
);
const authorityClosure = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260820111500_p0_signup_company_authority_closure.sql',
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
  it('treats all public signup role metadata as request data, never authority', () => {
    expect(authorityClosure).toContain("NEW.raw_app_meta_data ->> 'role'");
    expect(authorityClosure).not.toMatch(/NEW\.raw_user_meta_data\s*->>\s*'role'/);
    expect(authorityClosure).not.toMatch(/NEW\.raw_user_meta_data\s*->>\s*'requested_role'/);
    expect(authorityClosure).toContain('ELSE NULL');
    expect(authorityClosure).not.toContain("raw_user_meta_data ->> 'status'");
  });

  it('preserves legitimate server-controlled app-metadata identities', () => {
    expect(authorityClosure).toContain("WHEN 'owner' THEN 'owner'");
    expect(authorityClosure).toContain("WHEN 'company_admin' THEN 'company_admin'");
    expect(authorityClosure).toContain("WHEN 'company_staff' THEN 'company_staff'");
    expect(authorityClosure).toContain("WHEN 'broker' THEN 'broker'");
    expect(authorityClosure).toContain("WHEN 'driver' THEN 'driver'");
    expect(authorityClosure).toContain("WHEN 'customer' THEN 'customer'");
  });

  it('blocks authenticated self-mutation of authoritative profile fields', () => {
    expect(baseHardening).toContain('CREATE OR REPLACE FUNCTION public.guard_profile_authority_fields()');
    expect(baseHardening).toContain("v_jwt_role = 'authenticated'");
    expect(baseHardening).toContain('NEW.role IS DISTINCT FROM OLD.role');
    expect(baseHardening).toContain('NEW.status IS DISTINCT FROM OLD.status');
    expect(baseHardening).toContain('NEW.company_id IS DISTINCT FROM OLD.company_id');
    expect(baseHardening).toContain('NEW.is_driver IS DISTINCT FROM OLD.is_driver');
    expect(baseHardening).toContain("USING ERRCODE = '42501'");
  });

  it('keeps direct company provisioning pending until governance approval', () => {
    expect(authorityClosure).toContain("ALTER COLUMN status SET DEFAULT 'pending_approval'");
    expect(authorityClosure).toContain('CREATE POLICY "companies_insert_pending_creator"');
    expect(authorityClosure).toContain("status::text = 'pending_approval'");
    expect(authorityClosure).toContain('CREATE OR REPLACE FUNCTION public.guard_pending_creator_membership_activation()');
    expect(authorityClosure).toContain("NEW.status := 'invited'");
    expect(authorityClosure).toContain('CREATE OR REPLACE FUNCTION public.activate_company_creator_membership_on_approval()');
  });

  it('makes onboarding review the service-controlled profile-role promotion point', () => {
    expect(authorityClosure).toContain('review_onboarding_application_atomic_authority_base_v1');
    expect(authorityClosure).toContain("WHEN 'broker_shipper' THEN 'broker'");
    expect(authorityClosure).toContain("WHEN 'fleet_courier' THEN 'company_admin'");
    expect(authorityClosure).toContain("WHEN 'owner_driver' THEN 'driver'");
    expect(authorityClosure).toContain("WHEN 'customer_shipper' THEN 'customer'");
    expect(authorityClosure).toContain(
      'REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text)',
    );
    expect(authorityClosure).toContain('TO service_role;');
  });

  it('makes direct onboarding-document review Platform Owner only', () => {
    expect(storageAuthority).toContain('DROP POLICY IF EXISTS onboarding_docs_select_reviewer ON storage.objects;');
    expect(storageAuthority).toContain('DROP POLICY IF EXISTS onboarding_docs_select_tenant_reviewer ON storage.objects;');
    expect(storageAuthority).toContain('CREATE POLICY onboarding_docs_select_platform_owner');
    expect(storageAuthority).toContain("p.role = 'owner'");
    expect(storageAuthority).toContain("COALESCE(p.status::text, '') = 'active'");
    expect(storageAuthority).not.toContain('role_in_company::text');
  });

  it('keeps storage policy documentation portable across Supabase-owned storage.objects', () => {
    expect(baseHardening).not.toMatch(/COMMENT\s+ON\s+POLICY[\s\S]*ON\s+storage\.objects/i);
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
