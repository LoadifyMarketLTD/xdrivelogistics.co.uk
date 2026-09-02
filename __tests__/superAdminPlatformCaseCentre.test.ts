import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');
const MIGRATION = 'supabase/migrations/20260831235940_platform_case_centre.sql';

describe('Super Admin Platform Case Centre foundation', () => {
  it('keeps the cross-domain registry service-controlled and RLS protected', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.platform_cases');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.platform_case_events');
    expect(migration).toContain("status IN ('open', 'acknowledged', 'investigating', 'waiting')");
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.platform_cases FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.owner_create_platform_case');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.owner_mutate_platform_case');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.owner_create_platform_case(uuid, text, text, text, text, text, text, text, text, uuid, uuid, text, jsonb) TO service_role');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.owner_mutate_platform_case(uuid, uuid, text, text, uuid, jsonb) TO service_role');
    expect(migration).not.toContain('TO authenticated');
    expect(migration).not.toContain('TO anon');
  });

  it('enforces semantic transitions and durable lifecycle events', () => {
    const migration = readRepoFile(MIGRATION);
    for (const action of ['assign', 'acknowledge', 'investigate', 'wait', 'resolve', 'close', 'reopen']) {
      expect(migration).toContain(`p_action = '${action}'`);
    }
    expect(migration).toContain('A reason of at least 5 characters is required.');
    expect(migration).toContain('INSERT INTO public.platform_case_events');
    expect(migration).not.toContain('p_field');
    expect(migration).not.toContain('p_value');
  });

  it('routes Platform Owner Action Centre to the persistent case surface and Support context', () => {
    const actionCentre = readRepoFile('app/components/workspace/actionCentreConfig.ts');
    const shell = readRepoFile('app/super-admin/_components/SuperAdminCardNavigationShell.tsx');
    const alias = readRepoFile('app/super-admin/cases/page.tsx');
    expect(actionCentre).toContain("platform_owner: '/super-admin/action-centre'");
    expect(shell).toContain('getActionCentreRoute(actionRole)');
    expect(shell).toContain("pathname.startsWith('/super-admin/action-centre') || pathname.startsWith('/super-admin/cases')");
    expect(shell).toContain("return 'support'");
    expect(alias).toContain("redirect('/super-admin/action-centre')");
  });

  it('keeps API mutations behind active Platform Owner verification and semantic RPCs', () => {
    const listRoute = readRepoFile('app/api/super-admin/cases/route.ts');
    const detailRoute = readRepoFile('app/api/super-admin/cases/[caseId]/route.ts');
    const verifier = readRepoFile('app/api/super-admin/_lib/verifyPlatformOwner.ts');
    expect(listRoute).toContain('verifyPlatformOwner(request)');
    expect(detailRoute).toContain('verifyPlatformOwner(request)');
    expect(verifier).toContain("String(profile.role ?? '').toLowerCase() !== 'owner'");
    expect(verifier).toContain("String(profile.status ?? 'active').toLowerCase() !== 'active'");
    expect(listRoute).toContain("supabaseAdmin.rpc('owner_create_platform_case'");
    expect(detailRoute).toContain("supabaseAdmin.rpc('owner_mutate_platform_case'");
    expect(listRoute).not.toContain(".from('platform_cases').insert");
    expect(detailRoute).not.toContain(".from('platform_cases').update");
  });

  it('fails closed for Deploy Preview writes in both server and UI contracts', () => {
    const verifier = readRepoFile('app/api/super-admin/_lib/verifyPlatformOwner.ts');
    const listRoute = readRepoFile('app/api/super-admin/cases/route.ts');
    const detailRoute = readRepoFile('app/api/super-admin/cases/[caseId]/route.ts');
    const detailPage = readRepoFile('app/super-admin/action-centre/[caseId]/page.tsx');
    expect(verifier).toContain("const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])");
    expect(verifier).toContain('isSuperAdminDeployPreviewReadOnly() && !READ_ONLY_METHODS.has');
    expect(listRoute).toContain('readOnly = isSuperAdminDeployPreviewReadOnly()');
    expect(detailRoute).toContain('readOnly: isSuperAdminDeployPreviewReadOnly()');
    expect(detailPage).toContain('disabled={readOnly || Boolean(running)}');
    expect(detailPage).toContain('No case mutation was attempted.');
  });

  it('does not pull unrelated company-governance inspector controls into Layer 2B1', () => {
    const detailPage = readRepoFile('app/super-admin/action-centre/[caseId]/page.tsx');
    expect(detailPage).not.toContain('CompanyGovernanceControls');
    expect(detailPage).not.toContain('PlatformEntityInspector');
    expect(detailPage).not.toContain('/api/super-admin/inspect/');
  });
});
