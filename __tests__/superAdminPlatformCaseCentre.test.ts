import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('Super Admin Platform Case Centre', () => {
  it('keeps cross-domain cases separate from domain dispute/support records and service-controlled', () => {
    const migration = readRepoFile('supabase/migrations/20260831005000_platform_case_centre.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.platform_cases');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.platform_case_events');
    expect(migration).toContain("status IN ('open', 'acknowledged', 'investigating', 'waiting')");
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.platform_cases FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.owner_create_platform_case');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.owner_mutate_platform_case');
    expect(migration).not.toContain('GRANT EXECUTE ON FUNCTION public.owner_mutate_platform_case(uuid, uuid, text, text, uuid, jsonb) TO authenticated');
    expect(migration).not.toContain('GRANT EXECUTE ON FUNCTION public.owner_mutate_platform_case(uuid, uuid, text, text, uuid, jsonb) TO anon');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.owner_mutate_platform_case(uuid, uuid, text, text, uuid, jsonb) TO service_role');
  });

  it('enforces semantic case transitions rather than arbitrary row editing', () => {
    const migration = readRepoFile('supabase/migrations/20260831005000_platform_case_centre.sql');

    for (const action of ['assign', 'acknowledge', 'investigate', 'wait', 'resolve', 'close', 'reopen']) {
      expect(migration).toContain(`p_action = '${action}'`);
    }
    expect(migration).toContain('A reason of at least 5 characters is required.');
    expect(migration).toContain('INSERT INTO public.platform_case_events');
    expect(migration).not.toContain('p_field');
    expect(migration).not.toContain('p_value');
  });

  it('routes Platform Owner Action Centre to the persistent case surface', () => {
    const actionCentre = readRepoFile('app/components/workspace/actionCentreConfig.ts');
    const workspace = readRepoFile('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');

    expect(actionCentre).toContain("platform_owner: '/super-admin/action-centre'");
    expect(workspace).toContain("href: '/super-admin/action-centre'");
  });

  it('keeps case APIs behind active Platform Owner verification', () => {
    const listRoute = readRepoFile('app/api/super-admin/cases/route.ts');
    const detailRoute = readRepoFile('app/api/super-admin/cases/[caseId]/route.ts');
    const verifier = readRepoFile('app/api/super-admin/_lib/verifyPlatformOwner.ts');

    expect(listRoute).toContain('verifyPlatformOwner(request)');
    expect(detailRoute).toContain('verifyPlatformOwner(request)');
    expect(verifier).toContain("String(profile.role ?? '').toLowerCase() !== 'owner'");
    expect(verifier).toContain("String(profile.status ?? 'active').toLowerCase() !== 'active'");
    expect(listRoute).toContain("supabaseAdmin.rpc('owner_create_platform_case'");
    expect(detailRoute).toContain("supabaseAdmin.rpc('owner_mutate_platform_case'");
  });
});
