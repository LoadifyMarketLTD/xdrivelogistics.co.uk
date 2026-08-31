import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('SA-04 Super Admin Platform Entity Inspectors', () => {
  it('resolves every SA-03 entity through the canonical inspector API', () => {
    const route = readRepoFile('app/api/super-admin/inspect/[entityType]/[entityId]/route.ts');

    expect(route).toContain('verifyPlatformOwner(request)');
    for (const entityType of ['company', 'user', 'driver', 'vehicle', 'job', 'invoice', 'ticket', 'dispute', 'pod', 'case']) {
      expect(route).toContain(`case '${entityType}'`);
    }
    expect(route).not.toContain('export async function PATCH');
    expect(route).not.toContain('export async function POST');
    expect(route).not.toContain('p_field');
    expect(route).not.toContain('p_value');
  });

  it('renders the exact shared PlatformEntityInspector instead of a parallel detail UI', () => {
    const page = readRepoFile('app/super-admin/inspect/[entityType]/[entityId]/page.tsx');

    expect(page).toContain('PlatformEntityInspector');
    expect(page).toContain('PlatformEntityLink');
    expect(page).toContain("<ProtectedRoute allowedRoles={['owner']}>" );
    expect(page).toContain('/api/super-admin/inspect/${encodeURIComponent(entityTypeParam)}/${encodeURIComponent(entityIdParam)}');
  });

  it('makes the Job Inspector trace the commercial and execution transaction', () => {
    const route = readRepoFile('app/api/super-admin/inspect/[entityType]/[entityId]/route.ts');

    expect(route).toContain(".from('job_bids')");
    expect(route).toContain(".from('invoices')");
    expect(route).toContain(".from('job_disputes')");
    expect(route).toContain(".from('job_events')");
    expect(route).toContain(".from('notification_events')");
    expect(route).toContain("entityType: 'pod'");
    expect(route).toContain("title: 'Commercial companies'");
    expect(route).toContain("title: 'Executing driver'");
    expect(route).toContain("title: 'Executing vehicle'");
  });

  it('keeps POD inspection tied to physical job evidence and Case inspection truth-preserving', () => {
    const route = readRepoFile('app/api/super-admin/inspect/[entityType]/[entityId]/route.ts');

    expect(route).toContain('delivery_signature_data');
    expect(route).toContain('pod_photos');
    expect(route).toContain('hard_copy_pod');
    expect(route).toContain('No physical POD evidence is stored on the canonical job.');
    expect(route).toContain('Platform Case Centre schema is not applied in this environment.');
  });

  it('turns the main Operations, Finance and Fleet ledgers into inspector entry points', () => {
    const table = readRepoFile('app/super-admin/_components/SuperAdminLiveTablePage.tsx');
    expect(table).toContain('PlatformEntityLink');
    expect(table).toContain('entityLink?: LiveTableEntityLink<T>');

    const expectations: Array<[string, string]> = [
      ['app/super-admin/operations/jobs/page.tsx', "entityType: 'job'"],
      ['app/super-admin/operations/active-jobs/page.tsx', "entityType: 'job'"],
      ['app/super-admin/operations/pending-jobs/page.tsx', "entityType: 'job'"],
      ['app/super-admin/operations/completed-jobs/page.tsx', "entityType: 'job'"],
      ['app/super-admin/operations/deliveries/page.tsx', "entityType: 'job'"],
      ['app/super-admin/operations/pods/page.tsx', "entityType: 'pod'"],
      ['app/super-admin/operations/disputes/page.tsx', "entityType: 'dispute'"],
      ['app/super-admin/finance/invoices/page.tsx', "entityType: 'invoice'"],
      ['app/super-admin/users/drivers/page.tsx', "entityType: 'driver'"],
    ];

    for (const [path, expected] of expectations) {
      expect(readRepoFile(path)).toContain('entityLink=');
      expect(readRepoFile(path)).toContain(expected);
    }
  });
});
