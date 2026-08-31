import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('SA-03 Super Admin Global Platform Search', () => {
  it('uses an authenticated server-side platform search instead of navigation-only filtering', () => {
    const route = readRepoFile('app/api/super-admin/search/route.ts');
    const header = readRepoFile('app/super-admin/_components/SuperAdminTopNavigationShell.tsx');
    const workspace = readRepoFile('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');

    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain("Forbidden: active Platform Owner required.");
    expect(header).toContain("/super-admin/search?q=${encodeURIComponent(query)}");
    expect(header).toContain('aria-label="Global Platform Search"');
    expect(workspace).toContain("href: '/super-admin/search'");
  });

  it('covers every owner-mandated searchable entity source', () => {
    const route = readRepoFile('app/api/super-admin/search/route.ts');

    for (const entityType of ['job', 'company', 'user', 'driver', 'vehicle', 'invoice', 'ticket', 'dispute', 'pod', 'case']) {
      expect(route).toContain(`'${entityType}'`);
    }
    expect(route).toContain(".from('jobs')");
    expect(route).toContain(".from('companies')");
    expect(route).toContain(".from('profiles')");
    expect(route).toContain(".from('drivers')");
    expect(route).toContain(".from('vehicles')");
    expect(route).toContain(".from('invoices')");
    expect(route).toContain(".from('support_tickets')");
    expect(route).toContain(".from('job_disputes')");
    expect(route).toContain(".from('platform_cases')");
    expect(route).toContain('supabaseAdmin.auth.admin.listUsers');
  });

  it('keeps the unavailable Case Centre schema explicit instead of fabricating success', () => {
    const route = readRepoFile('app/api/super-admin/search/route.ts');
    const page = readRepoFile('app/super-admin/search/page.tsx');

    expect(route).toContain("CASE_SCHEMA_UNAVAILABLE_CODES");
    expect(route).toContain("Platform Case Centre schema is not applied in this environment.");
    expect(route).toContain('unavailableSources');
    expect(page).toContain('source unavailable');
    expect(page).not.toContain('Case source: 0');
  });

  it('makes every returned search result an inspector entry point', () => {
    const page = readRepoFile('app/super-admin/search/page.tsx');
    const link = readRepoFile('app/super-admin/_components/control-plane/PlatformEntityLink.tsx');

    expect(page).toContain('<PlatformEntityLink entityType={row.entityType} entityId={row.entityId} compact>Inspect</PlatformEntityLink>');
    expect(link).toContain('/super-admin/inspect/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}');
  });
});
