import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('SA-05 Super Admin notification entity closure', () => {
  it('carries canonical notification entity_type through the dedicated read model', () => {
    const notificationTypes = readRepoFile('app/api/super-admin/_lib/notificationEvents.ts');
    const route = readRepoFile('app/api/super-admin/notifications/route.ts');

    expect(notificationTypes).toContain('entity_type?: string | null');
    expect(notificationTypes).toContain('entity_type: row.entity_type');
    expect(route).toContain('event_type, entity_type, entity_id');
    expect(route).toContain('entity_type: row.entity_type');
  });

  it('uses active Platform Owner authority and canonical inspectors rather than generic lists', () => {
    const route = readRepoFile('app/api/super-admin/notifications/route.ts');

    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain("Forbidden: active Platform Owner required.");
    expect(route).toContain('/super-admin/inspect/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}');
    expect(route).not.toContain('/super-admin/operations/jobs?focus=');
    expect(route).not.toContain("return '/super-admin/finance/invoices'");
    expect(route).not.toContain("return '/super-admin/companies/approvals'");
  });

  it('resolves bid notifications to their canonical job transaction', () => {
    const route = readRepoFile('app/api/super-admin/notifications/route.ts');

    expect(route).toContain(".from('job_bids').select('id, job_id')");
    expect(route).toContain("entityType === 'bid'");
    expect(route).toContain("inspectorHref('job', jobId)");
  });

  it('routes POD notifications to physical POD inspection and onboarding to a real company or user identity', () => {
    const route = readRepoFile('app/api/super-admin/notifications/route.ts');

    expect(route).toContain("row.event_type.toLowerCase().includes('pod')");
    expect(route).toContain("inspectorHref('pod', row.entity_id)");
    expect(route).toContain(".from('onboarding_applications').select('id, company_id, user_id')");
    expect(route).toContain("{ entityType: 'company', entityId: String(row.company_id) }");
    expect(route).toContain("{ entityType: 'user', entityId: String(row.user_id) }");
  });

  it('suppresses View when a referenced canonical row is stale instead of creating a dead-end', () => {
    const route = readRepoFile('app/api/super-admin/notifications/route.ts');
    const pageLib = readRepoFile('app/super-admin/notifications/_lib/notificationsPage.tsx');

    expect(route).toContain('fetchExistingIds');
    expect(route).toContain('View is suppressed for those rows.');
    expect(route).toContain("row.entity_type !== 'system' && !row.view_href");
    expect(pageLib).toContain('row.view_href&&<Link href={row.view_href}');
  });
});
